from sortedcontainers import SortedDict
from decimal import Decimal
from collections import deque

class OrderBook:
    def __init__(self):
        self.bids = SortedDict()  # SortedDict for efficient price-based ordering of bids and asks
        self.asks = SortedDict()
        self.order_index = {} # Add index to quick access to order details by order_id

    def add_order(self, order):
        side = order["side"]
        price = Decimal(str(order["price"]))
        quantity = Decimal(str(order["quantity"]))
        order_id = order["order_id"]
        user_id = order["user_id"]

        book = self.bids if side == "buy" else self.asks
        if price not in book:
            book[price] = deque() # Create new price level if it doesn't exsit
        book[price].append((order_id)) 
        self.order_index[order_id] = (side, price, quantity, quantity, user_id) # Store order details in the index for quick access

    def cancel_order(self, order_id):
        if order_id in self.order_index:
            side, price, _, _, _ = self.order_index[order_id]  # Extract the side and price for the order , ignoring the other values
            book = self.bids if side == "buy" else self.asks
            book[price].remove(order_id)
            if not book[price]:
                del book[price] # Remove price level if it becomes empty 
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
            iterate_book = iter # Iterate from lowest to highest prcie
            price_condition = lambda op, ip: op <= ip
        else:  
            opposite_book = self.bids
            iterate_book = reversed # Iterate from hightest to lowest price
            price_condition = lambda op, ip: op >= ip

        for opposite_price, order_ids in iterate_book(opposite_book.items()): # Iterate through the oppsite book
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
                
                if input_quantity == 0: # fully matched, stop matching
                    break

            if not order_ids: # If this price level is now empty, remove it from the book
                del opposite_book[opposite_price]

            if input_quantity == 0: # If the input order is fully matched, stop looking for matches
                break

        if input_quantity > 0:   # If no matching and there's any quantity left, add it as a new order
            self.add_order({**order, "quantity": input_quantity})

    def get_order_book(self, levels: int = 10) -> dict:
        def aggregate_orders(book, reverse=False):  # Aggregate orders at each price level
            items = list(book.items()) # Convert SortedDict items to a list
            if reverse: # Reverse the list for bids to get descending order
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