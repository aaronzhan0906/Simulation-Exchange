from order_book import OrderBook
from decimal import Decimal
from snowflake import SnowflakeGenerator
from datetime import datetime, timezone

class MatchingEngine:
    def __init__(self, order_book: OrderBook, instance_id = 1):
        self.order_book: OrderBook = order_book
        self.snowflake_generator = SnowflakeGenerator(instance_id)

    def process_order(self, order_id, user_id, symbol, side, price, quantity, status):
        order = {
            "order_id": str(order_id),
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
            


            # input order
            input_order_result = {
                "trade_id": trade_id,
                "timestamp": timestamp,
                "order_id": order_id,
                "matched_order_id": match["matched_order_id"],
                "symbol": symbol,
                "side": side,
                "executed_quantity": str(match["trade_quantity"]),
                "executed_price": str(match["executed_price"]),
                "remaining_quantity": str(match["input_remaining_quantity"]),
                "status": "filled" if Decimal(match["input_remaining_quantity"]) == 0 else "partially_filled",
                "buyer": {
                    "user_id": user_id if side == "buy" else match["matched_user_id"],
                    "order_id": order_id if side == "buy" else match["matched_order_id"]
                },
                "seller": {
                    "user_id": match["matched_user_id"] if side == "buy" else user_id,
                    "order_id": match["matched_order_id"] if side == "buy" else order_id
                },
                "isTaker": True,
                "original_price": str(match["input_price"])
            }

            matched_order_result = {
                "trade_id": trade_id,
                "timestamp": timestamp,
                "order_id": match["matched_order_id"],
                "matched_order_id": order_id,
                "symbol": symbol,
                "side": "buy" if side == "sell" else "sell",
                "executed_quantity": str(match["trade_quantity"]),
                "executed_price": str(match["executed_price"]),
                "remaining_quantity": str(match["matched_remaining_quantity"]),
                "status": "filled" if Decimal(match["matched_remaining_quantity"]) == 0 else "partially_filled",
                "buyer": {
                    "user_id": user_id if side == "buy" else match["matched_user_id"],
                    "order_id": order_id if side == "buy" else match["matched_order_id"]
                },
                "seller": {
                    "user_id": match["matched_user_id"] if side == "buy" else user_id,
                    "order_id": match["matched_order_id"] if side == "buy" else order_id
                },
                "isTaker": False,
                "original_price": str(match["opposite_price"])
            }


            yield input_order_result
            yield matched_order_result

    def cancel_order(self, order_id, user_id, symbol):
        canceled_order = self.order_book.cancel_order(order_id)

        if canceled_order is None:
            # None is simple logic 
            return {
                "order_id": order_id,
                "status": "filled",
                "message": "Order not found or already fully executed"
            }
        
        side, price, current_quantity, original_quantity, order_user_id = canceled_order
        if order_user_id != user_id:
            return {
                "order_id": order_id,
                "status": "error",
                "message": "Order does not belong to the user"
            }
        
        executed_quantity = original_quantity - current_quantity
        if executed_quantity == 0:
            status = "CANCELED"
            message = "Order fully canceled"
        else: 
            status = "PARTIALLY_FILLED_CANCELED"
            message = "Order partially filled and canceled"

        cancel_result = {
            "order_id": order_id,
            "user_id": user_id,
            "side": side,
            "symbol": symbol,
            "price": str(price),
            "original_quantity": str(original_quantity),
            "executed_quantity": str(executed_quantity),
            "canceled_quantity": str(current_quantity),
            "status": status,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
            
        return cancel_result
        
    def get_market_depth(self, levels: int = 10):
        return self.order_book.get_order_book(levels)
