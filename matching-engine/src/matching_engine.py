from order_book import OrderBook
from snowflake import SnowflakeGenerator
from datetime import datetime, timezone

class MatchingEngine:
    def __init__(self, order_book: OrderBook, instance_id = 1):
        self.order_book: OrderBook = order_book
        self.snowflake_generator = SnowflakeGenerator(instance_id)

    def process_order(self, order_id, user_id, symbol, side, price, quantity, status):
        order = {
            "order_id": order_id,
            "user_id": user_id,
            "symbol": symbol,
            "side": side,
            "price": price,
            "quantity": quantity,
            "status": status
        }
        

        for match in self.order_book.match_order(order):
            # trade 
            trade_id = str(next(self.snowflake_generator))
            timestamp = datetime.now(timezone.utc).isoformat()
            
            trade_record = {
                "trade_id": trade_id,
                "timestamp": timestamp,
                "symbol": symbol,
                "price": str(match["executed_price"]),
                "quantity": str(match["trade_quantity"]),
                "buyer": {
                    "user_id": user_id if side == "buy" else match["matched_user_id"],
                    "order_id": order_id if side == "buy" else match["matched_order_id"]
                },
                "seller": {
                    "user_id": match["matched_user_id"] if side == "buy" else user_id,
                    "order_id": match["matched_order_id"] if side == "buy" else order_id
                }
            }

            # input order
            input_order_result = {
                "order_id": order_id,
                "matched_order_id": match["matched_order_id"],
                "symbol": symbol,
                "side": side,
                "executed_quantity": str(match["trade_quantity"]),
                "executed_price": str(match["executed_price"]),
                "remaining_quantity": str(match["input_remaining"]),
                "status": "completed" if match["input_remaining"] == 0 else "partial",
                "trade_record": trade_record
            }

            matched_order_result = {
                "order_id": match["matched_order_id"],
                "matched_order_id": order_id,
                "symbol": symbol,
                "side": "buy" if side == "sell" else "sell",
                "executed_quantity": str(match["trade_quantity"]),
                "executed_price": str(match["executed_price"]),
                "remaining_quantity": str(match["matched_remaining"]),
                "status": "completed" if match["matched_remaining"] == 0 else "partial",
                "trade_record": trade_record
            }


            yield input_order_result
            yield matched_order_result
        
    def get_market_depth(self, levels: int = 10):
        return self.order_book.get_order_book(levels)