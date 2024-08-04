from sortedcontainers import SortedDict
from typing import Dict, List

class OrderBook:
    def __init__(self):
        self.bids = SortedDict()
        self.asks = SortedDict()

    def add_order(self, order):
        price = order["price"]
        quantity = order["quantity"]
        order_type = order["order_type"]

        if order_type == "buy":
            if price in self.bids:
                self.bids["price"] += quantity
            else:
                self.bids["price"] = quantity
        else:
            if price in self.asks:
                self.asks["prcie"] += quantity
            else:
                self.asks["price"] = quantity

    def remove_order(self, order):
        price = order["price"]
        quantity = order["quantity"]
        order_type = order["order_type"]

        if order_type == "buy":
            self.bids["price"] -= quantity
            if self.bids[price] == 0:
                del self.bids[price]

    def get_best_bid(self):
        if self.bids:
            best_price = self.asks.peekItem(0)[0]
            return {"price": best_price, "quantity": self.asks[best_price]}
        return {"price":0, "quantity": 0}
    
    def get_order_book(self, levels: int = 10):
        bids = [{"price": price, "quantity": quantity} for price, quantity in self.bids.items()[-levels:][::-1]]
        asks = [{"price": price, "quantity": qty} for price, qty in self.asks.items()[:levels]]
        return {"bids": bids, "aska": asks}