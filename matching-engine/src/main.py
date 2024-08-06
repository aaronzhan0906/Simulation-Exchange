import asyncio
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine


async def main():
    kafka_client = KafkaClient()
    order_book = OrderBook()
    matching_engine = MatchingEngine(order_book)

    await kafka_client.setup()
    print("---------------------------------------------")
    print("Trading engine started. Waiting for orders...")

    # consumer
    async for order in kafka_client.consume_orders():
        print(f"Received order: {order}")

        # matching 
        result = matching_engine.process_order(order)

        # producer send matching result
        await kafka_client.produce_result("matched_orders", result)
        print(f"Sent result: {result}")

        # producer send order book snapshot
        snapshot = order_book.get_order_book()
        await kafka_client.produce_result("order_book_snapshot", snapshot)
        print(f"Sent order book snapshot")

        print("Current Order Book State:")
        print("Bids:", order_book.bids)
        print("Asks:", order_book.asks)
        print("-----------------------")

if __name__ == "__main__":
    asyncio.run(main())