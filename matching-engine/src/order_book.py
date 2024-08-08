from sortedcontainers import SortedDict
from decimal import Decimal
from collections import deque

class OrderBook:
    def __init__(self):
        self.bids = SortedDict()
        self.asks = SortedDict()

    def add_order(self, order):
        side = order["side"]
        price = Decimal(str(order["price"]))
        quantity = Decimal(str(order["quantity"]))
        order_id = order["order_id"]
        user_id = order["user_id"]

        book = self.bids if side == "buy" else self.asks
        if price not in book:
            book[price] = deque()
        book[price].append((user_id, order_id, quantity))

    def match_order(self, order):
        side = order["side"]
        input_user_id = order["user_id"]
        input_price = Decimal(str(order["price"]))
        quantity = Decimal(str(order["quantity"]))
        
        if side == "buy":
            opposite_book = self.asks
            iterate_book = iter
            price_condition = lambda op, ip: op <= ip
        else:  
            opposite_book = self.bids
            iterate_book = reversed
            price_condition = lambda op, ip: op >= ip

        for opposite_price, orders in iterate_book(opposite_book.items()):
            if not price_condition(opposite_price, input_price):
                break

            while orders and quantity > 0:
                matched_user_id, matched_order_id, matched_quantity = orders[0]
                trade_quantity = min(matched_quantity, quantity)
                
                matched_remaining = matched_quantity - trade_quantity
                
                yield {
                    "matched_order_id": matched_order_id,
                    "matched_user_id": matched_user_id,
                    "trade_quantity": trade_quantity,
                    "executed_price": opposite_price,  
                    "input_remaining": quantity - trade_quantity,
                    "matched_remaining": matched_remaining,
                    "input_price": input_price,  
                    "opposite_price": opposite_price,
                    "input_user_id": input_user_id
                }
                
                quantity -= trade_quantity
                
                if matched_remaining == 0:
                    orders.popleft()
                else:
                    orders[0] = (matched_user_id, matched_order_id, matched_remaining)

            if not orders:
                del opposite_book[opposite_price]

            if quantity == 0:
                break

        if quantity > 0:
            self.add_order({**order, "quantity": quantity})

    def get_order_book(self, levels: int = 10) -> dict:
        asks = []
        for price, queue in self.asks.items():
            if len(asks) >= levels:
                break
            total_quantity = sum(Decimal(str(order[2])) for order in queue)
            asks.append({"price": str(price), "quantity": str(total_quantity)})

        bids = []
        for price, queue in reversed(self.bids.items()):
            if len(bids) >= levels:
                break
            total_quantity = sum(Decimal(str(order[2])) for order in queue)
            bids.append({"price": str(price), "quantity": str(total_quantity)})

        return {"asks": asks, "bids": bids}

    def __str__(self):
        return f"Asks: {dict(self.asks)}\nBids: {dict(self.bids)}"
    
        # # Get the lowest ask price (first item in asks)
    # def get_best_ask(self):
    #     if self.asks:
    #         best_price = self.asks.peekitem(0)[0] 
    #         return {"price": best_price, "quantity": self.asks[best_price]}
    #     return {"price": 0, "quantity": 0}

    # # Get the highest bid price (last item in bids)
    # def get_best_bid(self):
    #     if self.bids:
    #         best_price = self.bids.peekitem(-1)[0]  
    #         return {"price": best_price, "quantity": self.bids[best_price]}
    #     return {"price": 0, "quantity": 0}