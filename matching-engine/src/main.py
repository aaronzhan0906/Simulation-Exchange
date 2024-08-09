import asyncio
from kafka_client import KafkaClient
from order_book import OrderBook
from matching_engine import MatchingEngine


async def main():
    kafka_client = KafkaClient()
    order_book = OrderBook()
    matching_engine = MatchingEngine(order_book)

    await kafka_client.setup()
    print("Trading engine started. Waiting for orders...")
    print("---------------------------------------------")

    try:
        # consumer
        async for order in kafka_client.consume_orders():
            print(f"Received order: userId {order["userId"]}")
            print(order)
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
            
            for trade_result in results:
                await kafka_client.produce_result("trade_result", trade_result)
                print("========================")
                print(f"Sent 'matched_orders': {trade_result}")

            # producer send order book snapshot
            order_book_snapshot = order_book.get_order_book()
            await kafka_client.produce_result("order_book_snapshot", order_book_snapshot)
            print("========================")
            print(f"Sent 'order_book_snapshot': {order_book_snapshot}")
            print("========================")
            # print("--------------------------")
            # print("Current Order Book State:")
            # print(f"Asks: {order_book_snapshot['asks']}")
            # print(f"Bids: {order_book_snapshot['bids']}")
            # print("--------------------------")

    finally:
        await kafka_client.close()

if __name__ == "__main__":
    asyncio.run(main())