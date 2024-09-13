import asyncio
import os
import time
import signal
from dotenv import load_dotenv
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine
import logging
from colorama import Fore, Style, init

init(autoreset=True)

class ColoredFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": Fore.CYAN,
        "INFO": Fore.GREEN,
        "WARNING": Fore.YELLOW,
        "ERROR": Fore.RED,
        "CRITICAL": Fore.RED + Style.BRIGHT
    }

    def format(self, record):
        levelname = record.levelname
        if levelname in self.COLORS:
            levelname_color = f"{self.COLORS[levelname]}[{levelname}]{Style.RESET_ALL}"
            record.levelname = levelname_color
        return super().format(record)

def setup_logger():
    """logger setting"""
    handler = logging.StreamHandler()
    formatter = ColoredFormatter(
        fmt="[%(asctime)s] - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)

    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger

logger = setup_logger()


load_dotenv()
SUPPORTED_SYMBOLS = os.environ.get("SUPPORTED_SYMBOLS").split(',')
SUPPORTED_SYMBOLS = [symbol.strip() for symbol in SUPPORTED_SYMBOLS]
REDIS_HOST = os.environ.get("REDIS_HOST")
REDIS_PORT = os.environ.get("REDIS_PORT")
REDIS_DB = os.environ.get("REDIS_DB")

order_books = {symbol: OrderBook(symbol) for symbol in SUPPORTED_SYMBOLS}
matching_engines = {
    symbol: MatchingEngine(order_book) for symbol, order_book in order_books.items() # [ "btc": MatchingEngine(OrderBook()) ,"eth": MatchingEngine(OrderBook()) ,...]
}  

# Create an asyncio Event for graceful shutdown
shutdown_event = asyncio.Event()

def signal_handler():  # Handle termination signals
    logging.info("Termination signal received, shutting down gracefully...")
    shutdown_event.set()


async def handle_new_order(order, matching_engine, kafka_client, order_book):
    symbol = order["symbol"].replace("_usdt","")
    # Process the order using the matching engine
    logging.info(f"Received new-order-{symbol}: {order}")
    results = matching_engine.process_order(
        order["orderId"], 
        order["userId"], 
        order["symbol"], 
        order["side"],
        order["price"],
        order["quantity"],
        order["status"]
    )
    
    # Send the results executed by matching engine to Kafka
    for trade_result in results:
        await kafka_client.produce_result(f"trade-result-{symbol}", trade_result)
        logging.info("========================")
        logging.info(f"Sent 'trade-result-{symbol}': {trade_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result(f"order-book-snapshot-{symbol}", order_book_snapshot)
    logging.info("========================")
    logging.info(f"Sent 'order-book-snapshot-{symbol}': {order_book_snapshot}")

# Function to handel order cancellation
async def handle_cancel_order(cancel_request, matching_engine, kafka_client, order_book):
    symbol = cancel_request["symbol"].replace("_usdt","")
    logger.info(f"Received cancel-order-{symbol}: {cancel_request}")
    cancel_result = matching_engine.cancel_order(
        cancel_request["orderId"],
        cancel_request["userId"],
        cancel_request["symbol"]
    )
    await kafka_client.produce_result(f"cancel-result-{symbol}", cancel_result)
    logging.info("========================")
    logging.info(f"Sent 'cancel-result-{symbol}': {cancel_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result(f"order-book-snapshot-{symbol}", order_book_snapshot)
    logging.info("========================")
    logging.info(f"Sent 'order-book-snapshot-{symbol}': {order_book_snapshot}")

# Function to periodically send order book snapshots
async def send_order_book_every_two_seconds(symbol, order_book, kafka_client):
    while not shutdown_event.is_set(): # while true
        try:
            start_time = time.time()
            order_book_snapshot = order_book.get_order_book()
            await kafka_client.produce_result(f"order-book-snapshot-{symbol}", order_book_snapshot)

            elapsed_time = time.time() - start_time
            sleep_time = max(0, 2 - elapsed_time)
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=sleep_time)
            except asyncio.TimeoutError:
                pass
        except asyncio.CancelledError:
            logging.info(f"Order book snapshot task cancelled - {symbol}")
            break


async def shutdown(kafka_client, tasks):
    logging.info("Starting to shut down the program...")
    
    for order_book in order_books.values(): # Stop all order book snapshot timers
        order_book.stop_snapshot_timer()
    
    for task in tasks: # Cancel all tasks
        if not task.done():
            task.cancel()
    
    try:    # Wait for all tasks to complete with a timeout
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=10)
    except asyncio.TimeoutError:
        logging.warning("Some tasks did not complete in time")
    
    for order_book in order_books.values(): # Close all order books and save final snapshots
        await order_book.close()
    
    await kafka_client.close()   # Close the Kafka client

    logging.info("Program has been completely shut down")


# Main function to setup and run the trading engine
async def main():
    loop = asyncio.get_running_loop() # Get the current running event loop
    
    for sig in (signal.SIGINT, signal.SIGTERM): # Set up signal handlers for graceful shutdown
        loop.add_signal_handler(sig, signal_handler)

    kafka_client = KafkaClient()
    await kafka_client.setup()
    logging.info("Trading engine started")
    logging.info("----------------------")

    for symbol in SUPPORTED_SYMBOLS:
        kafka_client.add_topic_handler(
            f"new-order-{symbol}",
            lambda order, s=symbol: handle_new_order(order, matching_engines[s], kafka_client, order_books[s])
        )
        kafka_client.add_topic_handler(
            f"cancel-order-{symbol}",
            lambda cancel_request, s=symbol: handle_cancel_order(cancel_request, matching_engines[s], kafka_client, order_books[s])
        )
    
    # Create tasks for sending order book snapshots
    tasks = [
        asyncio.create_task(send_order_book_every_two_seconds(symbol, order_book, kafka_client))
        for symbol, order_book in order_books.items()
    ]
    
    # Start order book snapshot timers
    snapshot_tasks = [asyncio.create_task(order_book.start_snapshot_timer()) for order_book in order_books.values()]
    tasks.extend(snapshot_tasks)
    
     # Create task for Kafka message consumption
    kafka_consumer_task = asyncio.create_task(kafka_client.consume_messages())
    tasks.append(kafka_consumer_task)

    try:
        await asyncio.shield(shutdown_event.wait()) # Wait for the shutdown signal to be set (shutdown_event = True)
    except asyncio.CancelledError:
        logging.info("Main task cancelled")
    except Exception as e:
        logging.error(f"Error in main loop: {e}")
    finally:
        await shutdown(kafka_client, tasks) # Perform shutdown procedure


if __name__ == "__main__":
    asyncio.run(main())