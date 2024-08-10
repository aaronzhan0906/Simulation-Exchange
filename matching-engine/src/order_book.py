from sortedcontainers import SortedDict
from decimal import Decimal
from collections import deque

class OrderBook:
    def __init__(self):
        self.bids = SortedDict()
        self.asks = SortedDict()
        self.order_index = {}

    def add_order(self, order):
        side = order["side"]
        price = Decimal(str(order["price"]))
        quantity = Decimal(str(order["quantity"]))
        order_id = order["order_id"]
        user_id = order["user_id"]

        book = self.bids if side == "buy" else self.asks
        if price not in book:
            book[price] = deque()
        book[price].append((order_id))
        # save details in index
        self.order_index[order_id] = (side, price, quantity, quantity, user_id)

    def cancel_order(self, order_id):
        if order_id in self.order_index:
            side, price, _, _, _ = self.order_index[order_id]
            book = self.bids if side == "buy" else self.asks
            book[price].remove(order_id)
            if not book[price]:
                del book[price]
            return self.order_index.pop(order_id)
        return None
        

    def match_order(self, order):
        side = order["side"]
        input_price = Decimal(str(order["price"]))
        input_quantity = Decimal(str(order["quantity"]))
        input_order_id = order["order_id"]
        input_user_id = order["user_id"]

        
        if side == "buy":
            opposite_book = self.asks
            iterate_book = iter
            price_condition = lambda op, ip: op <= ip
        else:  
            opposite_book = self.bids
            iterate_book = reversed
            price_condition = lambda op, ip: op >= ip

        for opposite_price, order_ids in iterate_book(opposite_book.items()):
            if not price_condition(opposite_price, input_price):
                break

            for matched_order_id in list(order_ids):
                matched_side, _, matched_quantity, matched_original_quantity, matched_user_id = self.order_index[matched_order_id]
                trade_quantity = min(matched_quantity, input_quantity)

                self.order_index[matched_order_id] = (matched_side, opposite_price, matched_quantity - trade_quantity, matched_original_quantity, matched_user_id)
                
                if matched_quantity == trade_quantity:
                    order_ids.remove(matched_order_id)

                input_quantity -= trade_quantity

                yield {
                    "matched_order_id": matched_order_id,
                    "matched_user_id": matched_user_id,
                    "trade_quantity": trade_quantity,
                    "executed_price": opposite_price,  
                    "input_remaining_quantity": input_quantity,
                    "matched_remaining_quantity": matched_quantity - trade_quantity,
                    "input_price": input_price,  
                    "opposite_price": opposite_price,
                    "input_user_id": input_user_id,
                    "input_order_id": input_order_id
                }
                
                if input_quantity == 0:
                    break

            if not order_ids:
                del opposite_book[opposite_price]

            if input_quantity == 0:
                break

        if input_quantity > 0:
            self.add_order({**order, "quantity": input_quantity})

    def get_order_book(self, levels: int = 10) -> dict:
        def aggregate_orders(book, reverse=False):
            items = list(book.items())
            if reverse:
                items.reverse()
            return [{"price": str(price), "quantity": str(sum(self.order_index[order_id][2] for order_id in orders))} 
                    for price, orders in items][:levels]
        
        return {
            "asks": aggregate_orders(self.asks),
            "bids": aggregate_orders(self.bids, reverse=True)
        }

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