from order_book import OrderBook
from typing import Dict, List
from decimal import Decimal

class MatchingEngine:
    def __init__(self, order_book: OrderBook):
        self.order_book: OrderBook = order_book

    def process_order(self, order_id, symbol, side, price, quantity) -> Dict:
        price = Decimal(str(price))
        quantity = Decimal(str(quantity))

        opposite_book = self.order_book.asks if side == "buy" else self.order_book.bids

        trades: List[Dict[str, Decimal]] = []
        for opposite_price, opposite_quantity in opposite_book.items():
            opposite_price = Decimal(str(opposite_price))
            opposite_quantity = Decimal(str(opposite_quantity))

            if (side == "buy" and opposite_price > price) or (side == "sell" and opposite_price < price):
                break

            trade_quantity = min(opposite_quantity, quantity)
            trades.append({"price": opposite_price, "quantity": trade_quantity})
            self.order_book.remove_order({
                "price": opposite_price,
                "quantity": trade_quantity,
                "side": "sell" if side == "buy" else "buy"
            })
            quantity -= trade_quantity

            if quantity == Decimal("0"):
                return {"status": "completed", "trades": trades}
            
        if quantity > Decimal("0"):
            self.order_book.add_order({"price": price, "quantity": quantity, "side": side})
            if trades:
                return {"status": "partial", "trades": trades, "remaining": quantity}
            else:
                return {"status": "pending", "remaining": quantity}
            
    def get_market_depth(self, levels: int = 10):
        return self.order_book.get_order_book(levels)