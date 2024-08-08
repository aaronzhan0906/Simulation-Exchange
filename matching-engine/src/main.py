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

    try:
        # consumer
        async for order in kafka_client.consume_orders():
            print(f"Received order: {order}")

            # matching 
            results = matching_engine.process_order(
                order["orderId"], 
                order["userId"], 
                order["symbol"], 
                order["side"],
                order["price"],
                order["quantity"],
                order["status"]
            )
            
            for result in results:
                await kafka_client.produce_result("matched_orders", result)
                print("========================")
                print(f"Sent result: {result}")

            # producer send order book snapshot
            snapshot = order_book.get_order_book()
            await kafka_client.produce_result("order_book_snapshot", snapshot)

            print("--------------------------")
            print("Current Order Book State:")
            order_book_snapshot = order_book.get_order_book()
            print(f"Asks: {order_book_snapshot['asks']}")
            print(f"Bids: {order_book_snapshot['bids']}")
            print("--------------------------")

    finally:
        await kafka_client.close()

if __name__ == "__main__":
    asyncio.run(main())