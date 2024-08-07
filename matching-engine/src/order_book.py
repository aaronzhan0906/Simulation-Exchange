from sortedcontainers import SortedDict
from typing import Dict, List

class OrderBook:
    def __init__(self):
        self.bids = SortedDict()
        self.asks = SortedDict()

    def add_order(self, order):
        price = order["price"]
        quantity = order["quantity"]
        side = order["side"]

        if side == "buy":
            if price in self.bids:
                self.bids[price] += quantity
            else:
                self.bids[price] = quantity
        else:
            if price in self.asks:
                self.asks[price] += quantity
            else:
                self.asks[price] = quantity

    def remove_order(self, order):
        price = order["price"]
        quantity = order["quantity"]
        side = order["side"]

        if side == "buy":
            self.bids[price] -= quantity
            if self.bids[price] <= 0:
                del self.bids[price]
        else:
            self.asks[price] -= quantity
            if self.asks[price] <= 0:
                del self.asks[price]

    def get_best_bid(self):
        if self.bids:
            best_price = self.bids.peekitem(-1)[0]  # SortedDict 是升序，所以最后一个是最高价
            return {"price": best_price, "quantity": self.bids[best_price]}
        return {"price": 0, "quantity": 0}
    
    def get_best_ask(self):
        if self.asks:
            best_price = self.asks.peekitem(0)[0]  # 最低的卖价
            return {"price": best_price, "quantity": self.asks[best_price]}
        return {"price": 0, "quantity": 0}

    def get_order_book(self, levels: int = 10):
        bids = [{"price": price, "quantity": quantity} for price, quantity in self.bids.items()[-levels:][::-1]]
        asks = [{"price": price, "quantity": quantity} for price, quantity in self.asks.items()[:levels]]
        return {"bids": bids, "asks": asks}

    def __str__(self):
        return f"Bids: {dict(self.bids)}\nAsks: {dict(self.asks)}"