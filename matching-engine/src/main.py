import asyncio
import os
import time
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine

SUPPORTED_SYMBOLS = os.environ.get("SUPPORTED_SYMBOLS", "btc,eth,bnb,ton,avax").split(',')
SUPPORTED_SYMBOLS = [symbol.strip() for symbol in SUPPORTED_SYMBOLS]

order_books = {symbol: OrderBook() for symbol in SUPPORTED_SYMBOLS}
matching_engines = {
    symbol: MatchingEngine(order_book) for symbol, order_book in order_books.items() # [ "btc": MatchingEngine(OrderBook()) ,"eth": MatchingEngine(OrderBook()) ,...]
}  

async def handle_new_order(order, matching_engine, kafka_client, order_book):
    symbol = order["symbol"]
    # Process the order using the matching engine
    print("Received new-orders:",order)
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
        await kafka_client.produce_result(f"trade_result_{symbol}", trade_result)
        print("========================")
        print(f"Sent 'trade_result_{symbol}': {trade_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result(f"order_book_snapshot_{symbol}", order_book_snapshot)
    print("========================")
    print(f"Sent 'order_book_snapshot_{symbol}': {order_book_snapshot}")
    print("========================")

# Function to handel order cancellation
async def handle_cancel_order(cancel_request, matching_engine, kafka_client, order_book):
    symbol = cancel_request["symbol"]
    print(f"Received cancel-orders:", cancel_request)
    cancel_result = matching_engine.cancel_order(
        cancel_request["orderId"],
        cancel_request["userId"],
        cancel_request["symbol"]
    )
    await kafka_client.produce_result(f"cancel_result_{symbol}", cancel_result)
    print("========================")
    print(f"Sent 'cancel_result_{symbol}': {cancel_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result(f"order_book_snapshot{symbol}", order_book_snapshot)
    print("========================")
    print(f"Sent 'order_book_snapshot_{symbol}': {order_book_snapshot}")
    print("========================")

# Function to periodically send order book snapshots
async def send_order_book_every_two_second(symbol, order_book, kafka_client):
    while True:
        start_time = time.time()
        order_book_snapshot = order_book.get_order_book()
        await kafka_client.produce_result(f"order_book_snapshot_{symbol}", order_book_snapshot)

        # every 2s
        elapsed_time = time.time() - start_time
        sleep_time = max(0, 10 - elapsed_time) # 先調低
        await asyncio.sleep(sleep_time)

# Main function to setup and run the trading engine
async def main():
    kafka_client = KafkaClient()
    await kafka_client.setup()
    print("Trading engine started")
    print("----------------------")

    for symbol in SUPPORTED_SYMBOLS:
        kafka_client.add_topic_handler(
            f"new-order-{symbol}",
            lambda order, s=symbol: handle_new_order(order, matching_engines[s], kafka_client, order_books[s])
        )
        kafka_client.add_topic_handler(
            f"cancel-order-{symbol}",
            lambda cancel_request, s=symbol: handle_cancel_order(cancel_request, matching_engines[s], kafka_client, order_books[s])
        )
    
    for symbol, order_book in order_books.items():
        asyncio.create_task(send_order_book_every_two_second(symbol, order_book, kafka_client))

    try:
        await kafka_client.consume_messages()
    finally:
        await kafka_client.close()

if __name__ == "__main__":
    asyncio.run(main())