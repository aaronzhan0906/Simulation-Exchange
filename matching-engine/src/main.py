import asyncio
import time
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine

async def handle_new_order(order, matching_engine, kafka_client, order_book):
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
    
    for trade_result in results:
        await kafka_client.produce_result("trade_result", trade_result)
        print("========================")
        print(f"Sent 'trade_result': {trade_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result("order_book_snapshot", order_book_snapshot)
    print("========================")
    print(f"Sent 'order_book_snapshot': {order_book_snapshot}")
    print("========================")

async def handle_cancel_order(cancel_request, matching_engine, kafka_client, order_book):
    print(f"Received cancel-orders:", cancel_request)
    cancel_result = matching_engine.cancel_order(
        cancel_request["orderId"],
        cancel_request["userId"],
        cancel_request["symbol"]
    )
    await kafka_client.produce_result("cancel_result", cancel_result)
    print("========================")
    print(f"Sent 'cancel_result': {cancel_result}")

    order_book_snapshot = order_book.get_order_book()
    await kafka_client.produce_result("order_book_snapshot", order_book_snapshot)
    print("========================")
    print(f"Sent 'order_book_snapshot': {order_book_snapshot}")
    print("========================")

async def send_order_book_every_two_second(order_book, kafka_client):
    while True:
        start_time = time.time()
        order_book_snapshot = order_book.get_order_book()
        await kafka_client.produce_result("order_book_snapshot", order_book_snapshot)

        # every 2s
        elapsed_time = time.time() - start_time
        sleep_time = max(0, 2 - elapsed_time)
        await asyncio.sleep(sleep_time)


async def main():
    kafka_client = KafkaClient()
    order_book = OrderBook()
    matching_engine = MatchingEngine(order_book)

    await kafka_client.setup()
    print("Trading engine started. Waiting for orders and cancellations...")
    print("---------------------------------------------")

    kafka_client.add_topic_handler("new-orders", 
        lambda order: handle_new_order(order, matching_engine, kafka_client, order_book))
    kafka_client.add_topic_handler("cancel-orders", 
        lambda cancel_request: handle_cancel_order(cancel_request, matching_engine, kafka_client, order_book))

    asyncio.create_task(send_order_book_every_two_second(order_book, kafka_client))

    try:
        await kafka_client.consume_messages()
    finally:
        await kafka_client.close()

if __name__ == "__main__":
    asyncio.run(main())