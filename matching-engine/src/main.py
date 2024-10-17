import asyncio
import os
import time
import signal
from dotenv import load_dotenv
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine
import logging


error_counter = 0
MAX_ERRORS = 10 

global_order_book_snapshots = {}


class Colors:
    RESET = "\033[0m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

class ColoredFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": Colors.CYAN,
        "INFO": Colors.GREEN,
        "WARNING": Colors.YELLOW,
        "ERROR": Colors.RED,
        "CRITICAL": Colors.RED + Colors.WHITE
    }

    def format(self, record):
        levelname = record.levelname
        if levelname in self.COLORS:
            levelname_color = f"{self.COLORS[levelname]}[{levelname}]{Colors.RESET}"
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

def signal_handler(signum, frame):  # Handle termination signals
    logging.info(f"Termination signal received: {signum}, shutting down gracefully...")
    shutdown_event.set() # Set the shutdown event to stop running tasks

async def handle_new_order(order, matching_engine, kafka_client, order_book):
    global error_counter
    try:
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

        # order_book_snapshot = order_book.get_order_book()
        # await kafka_client.produce_result(f"order-book-snapshot-{symbol}", order_book_snapshot)
        # logging.info("========================")
        # logging.info(f"Sent 'order-book-snapshot-{symbol}': {order_book_snapshot}")

        error_counter = 0  # 重置錯誤計數器
    except Exception as e:
        error_counter += 1
        logging.error(f"處理新訂單時發生錯誤: {e}")
        if error_counter >= MAX_ERRORS:
            logging.critical(f"錯誤次數超過 {MAX_ERRORS}")

# Function to handel order cancellation
async def handle_cancel_order(cancel_request, matching_engine, kafka_client, order_book):
    global error_counter
    try:
        symbol = cancel_request["symbol"].replace("_usdt","")
        logger.info(f"Received cancel-order-{symbol}: {cancel_request}")
        cancel_result = matching_engine.cancel_order(
            cancel_request["orderId"],
            cancel_request["userId"],
            cancel_request["symbol"],
            cancel_request["side"],
            cancel_request["price"]
        )
        await kafka_client.produce_result(f"cancel-result-{symbol}", cancel_result)
        logging.info("========================")
        logging.info(f"Sent 'cancel-result-{symbol}': {cancel_result}")

        # order_book_snapshot = order_book.get_order_book()
        # await kafka_client.produce_result(f"order-book-snapshot-{symbol}", order_book_snapshot)
        # logging.info("========================")
        # logging.info(f"Sent 'order-book-snapshot-{symbol}")

        error_counter = 0  
    except Exception as e:
        error_counter += 1
        logging.error(f"處理取消訂單請求時發生錯誤: {e}")
        if error_counter >= MAX_ERRORS:
            logging.critical(f"錯誤次數超過 {MAX_ERRORS}")
    

# Function to periodically send order book snapshots
async def update_order_book_snapshot(symbol, order_book):
    global global_order_book_snapshots
    while not shutdown_event.is_set():
        try:
            snapshot = order_book.get_order_book()
            global_order_book_snapshots[symbol] = snapshot
            await asyncio.sleep(0.1)  
        except asyncio.CancelledError:
            logging.info(f"update_order_book_snapshot Canceled- {symbol}")
            break
        except Exception as e:
            logging.error(f"更新訂單簿快照時發生錯誤 - {symbol}: {e}")
            await asyncio.sleep(1)  

async def send_order_book_snapshots_every_300ms(kafka_client):
    global error_counter, global_order_book_snapshots
    while not shutdown_event.is_set():
        try:
            start_time = time.time()

            for symbol, snapshot in global_order_book_snapshots.items():
                await kafka_client.produce_result(f"order-book-snapshot-{symbol}", snapshot)
                # logger.info(f"sent [order-book-snapshot-{symbol}]")


            elapsed_time = time.time() - start_time
            sleep_time = max(0, 0.3 - elapsed_time)
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=sleep_time)
            except asyncio.TimeoutError:
                pass

            error_counter = 0  
        except asyncio.CancelledError:
            logging.info("[send_order_book_snapshots_every_300ms] canceled")
            break
        except Exception as e:
            error_counter += 1
            logging.error(f"發送訂單簿快照時出現錯誤 {e}")
            if error_counter >= MAX_ERRORS:
                logging.critical(f"錯誤次數超過 {MAX_ERRORS}")
            await asyncio.sleep(5)  

async def shutdown(kafka_client, tasks):
    logging.info("Starting to shut down the program...")
    
    for order_book in order_books.values(): # Stop all order book snapshot timers
        order_book.stop_snapshot_timer()
    
    for task in tasks: # Cancel all tasks
        if not task.done():
            task.cancel()
    
    try:    # Wait for all tasks to complete with a timeout
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30)
    except asyncio.TimeoutError:
        logging.warning("Some tasks did not complete in time")
    
    for order_book in order_books.values(): # Close all order books and save final snapshots
        await order_book.close()
    
    await kafka_client.close()   # Close the Kafka client

    logging.info("Program has been completely shut down")


# Main function to setup and run the trading engine
async def main():
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, signal_handler) # Register signal handlers
    
    try:
        kafka_client = KafkaClient()
        await kafka_client.setup()
        logging.info("Trading engine started")
        logging.info("----------------------")
        tasks = []
        for symbol in SUPPORTED_SYMBOLS:
            kafka_client.add_topic_handler(
                f"new-order-{symbol}",
                lambda order, s=symbol: handle_new_order(order, matching_engines[s], kafka_client, order_books[s])
            )
            kafka_client.add_topic_handler(
                f"cancel-order-{symbol}",
                lambda cancel_request, s=symbol: handle_cancel_order(cancel_request, matching_engines[s], kafka_client, order_books[s])
            )
            
            update_task = asyncio.create_task(update_order_book_snapshot(symbol, order_books[symbol]))
            tasks.append(update_task)

        send_snapshot_task = asyncio.create_task(send_order_book_snapshots_every_300ms(kafka_client))
        tasks.append(send_snapshot_task)
        
        kafka_consumer_task = asyncio.create_task(kafka_client.consume_messages())
        tasks.append(kafka_consumer_task)

        await shutdown_event.wait()
    except Exception as e:
        logging.error(f"An error occurred in the main loop: {e}")
    finally:
        await shutdown(kafka_client, tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Program interrupted by user")
    except Exception as e:
        logging.critical(f"Critical error occurred: {e}")
    finally:
        logging.info("Program exited")