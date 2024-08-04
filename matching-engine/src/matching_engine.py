from order_book import OrderBook
from typing import Dict, List

class MatchingEngine:
    def __init__(self, order_book: OrderBook):
        self.order_book: OrderBook = order_book

    def process_order(self, order_type: str, price: float, quantity: float) -> Dict:
        opposite_book = self.order_book.asks if order_type == "buy" else self.order_book.bids

        trades: List[Dict[str, float]] = []
        for opposite_price, opposite_quantity in opposite_book.items():
            if (order_type == "buy" and opposite_price > price) or (order_type == "sell" and opposite_price < price):
                break

            trade_quantity = min(opposite_quantity, quantity)
            trades.append({"price": opposite_price, "quantity": trade_quantity})
            self.order_book.remove_order({
                "price": opposite_price,
                "quantity": trade_quantity,
                "order_type": "sell" if order_type == "buy" else "buy"
            })
            quantity -= trade_quantity

            if quantity == 0:
                return {"status": "completed", "trades": trades}
            
        if quantity > 0:
            self.order_book.add_order({"price": price, "quantity": quantity, "order_type": order_type})
            if trades:
                return {"status": "partial", "trades": trades, "remaining": quantity}
            else:
                return {"status": "pending", "remaining": quantity}
            
    def get_market_depth(self, levels: int = 10):
        return self.order_book.get_order_book(levels)