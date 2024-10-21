import os
import redis
import asyncio
import pickle
from sortedcontainers import SortedDict
from decimal import Decimal
import logging

class OrderBook:
    def __init__(self, symbol):
        self.symbol = symbol
        self.bids = SortedDict()
        self.asks = SortedDict()
        
        # Redis 
        redis_host = os.environ.get("REDIS_HOST")
        redis_port = int(os.environ.get("REDIS_PORT"))
        redis_db = int(os.environ.get("REDIS_DB"))

        self.redis_client = redis.StrictRedis(host=redis_host, port=redis_port, db=redis_db)
        
        self.load_snapshot() # if null create snapshot in redis
        
        self.is_running = True

    async def start_snapshot_timer(self):
        while self.is_running:
            try:
                await self.save_snapshot()
                await asyncio.sleep(5)
            except Exception as e:
                logging.error(f"Error in snapshot timer for {self.symbol}: {e}")
                await asyncio.sleep(1)

    def stop_snapshot_timer(self):
        self.is_running = False

    def take_snapshot(self):
        try:
            self.save_snapshot()
            self.start_snapshot_timer()
        except Exception as e:
            logging.error(f"Error taking snapshot for {self.symbol}: {e}")

    def load_snapshot(self):
        try:
            serialized_data = self.redis_client.get(f"order_book_snapshot:{self.symbol}")
            if serialized_data:
                data = pickle.loads(serialized_data)
                self.bids = SortedDict()
                self.asks = SortedDict()
                
                for price, orders in data["bids"].items():
                    price = Decimal(price)
                    self.bids[price] = {order_id: (Decimal(quantity), Decimal(original_quantity), user_id) for order_id, quantity, original_quantity, user_id in orders}
                
                for price, orders in data["asks"].items():
                    price = Decimal(price)
                    self.asks[price] = {order_id: (Decimal(quantity), Decimal(original_quantity), user_id) for order_id, quantity, original_quantity, user_id in orders}
                
                logging.info(f"Order book snapshot loaded from Redis（{self.symbol}）")
            else:
                logging.info(f"No order book snapshot found（{self.symbol}），initializing an empty order book.")
        except Exception as e:
            logging.error(f"Error loading snapshot for {self.symbol}: {e}")
            raise

    async def save_snapshot(self):
        try:
            serialized_data = pickle.dumps({
                "bids": {str(price): [(order_id, str(quantity), str(original_quantity), user_id)
                                      for order_id, (quantity, original_quantity, user_id) in orders.items()]
                         for price, orders in self.bids.items()},
                "asks": {str(price): [(order_id, str(quantity), str(original_quantity), user_id)
                                      for order_id, (quantity, original_quantity, user_id) in orders.items()]
                         for price, orders in self.asks.items()},
            })
            await asyncio.to_thread(self.redis_client.set, f"order_book_snapshot:{self.symbol}", serialized_data)
        except Exception as e:
            logging.error(f"Error saving snapshot for {self.symbol}: {e}")
            raise

    def get_order_book(self, levels: int = 10) -> dict:
        try:
            def aggregate_orders(book, reverse=False):
                items = list(book.items())
                if reverse:
                    items.reverse()
                result = []
                for price, orders in items[:levels]:
                    total_quantity = sum(quantity for quantity, _, _ in orders.values())
                    result.append({"price": str(price), "quantity": str(total_quantity)})
                return result
            
            return {
                "asks": aggregate_orders(self.asks),
                "bids": aggregate_orders(self.bids, reverse=True)
            }
        except Exception as e:
            logging.error(f"Error getting order book for {self.symbol}: {e}")
            raise
    
    async def close(self):
        try:
            self.stop_snapshot_timer()
            await self.save_snapshot() 
            logging.info(f"Final snapshot for {self.symbol} saved successfully")
        except Exception as e:
            logging.error(f"Error closing OrderBook for {self.symbol}: {e}")


## ORDER BOOK MATCHING LOGIC #######################################

    def add_order(self, order):
        try:
            side = order["side"]
            price = Decimal(str(order["price"]))
            quantity = Decimal(str(order["quantity"]))
            order_id = order["order_id"]
            user_id = order["user_id"]
            book = self.bids if side == "buy" else self.asks
            if price not in book:
                book[price] = {}
            book[price][order_id] = (quantity, quantity, user_id)
        except Exception as e:
            logging.error(f"Error adding order for {self.symbol}: {e}")
            raise


    def cancel_order(self, order_id, side, price):
        try:
            book = self.bids if side == "buy" else self.asks
            price = Decimal(str(price))

            if price in book and order_id in book[price]:
                current_quantity, original_quantity, user_id = book[price].pop(order_id)
                if not book[price]: # if no order after pop, delete this key
                    del book[price]
                return (side, price, current_quantity, original_quantity, user_id)
    
            logging.info(f"Order {order_id} not found in order book. It may have been cancelled or executed.")
            return None
        except Exception as e:
            logging.error(f"Error cancelling order {order_id} for {self.symbol}: {e}")
            raise

    def match_order(self, order):
        try:
            side = order["side"]
            input_price = Decimal(str(order["price"]))
            input_quantity = Decimal(str(order["quantity"]))
            input_order_id = order["order_id"]
            input_user_id = order["user_id"]
                        
            if side == "buy":
                opposite_book = self.asks 
                price_condition = lambda op, ip: op <= ip
                get_best_price = lambda: next(iter(opposite_book), None) if opposite_book else None
            else:  
                opposite_book = self.bids
                price_condition = lambda op, ip: op >= ip
                get_best_price = lambda: next(reversed(opposite_book), None) if opposite_book else None

            while True:
                opposite_price = get_best_price()
                if opposite_price is None or not price_condition(opposite_price, input_price):
                    break

                orders = opposite_book[opposite_price]
                logging.info(f"Matching at price level: {opposite_price}, Orders: {list(orders.keys())}")

                for matched_order_id, (matched_quantity, matched_original_quantity, matched_user_id) in list(orders.items()):
                    trade_quantity = min(matched_quantity, input_quantity)
                    orders[matched_order_id] = (matched_quantity - trade_quantity, matched_original_quantity, matched_user_id)
                    
                    if matched_quantity == trade_quantity:
                        del orders[matched_order_id]

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
                    
                    if input_quantity == 0:   # fully matched, stop matching
                        break

                if not orders:   # If this price level is now empty, remove it from the book
                    try:
                        del opposite_book[opposite_price]
                    except KeyError:
                        logging.error(f"Failed to remove empty price level {opposite_price} from order book for {self.symbol}")

                if input_quantity == 0:   # If the input order is fully matched, stop looking for matches
                    break

            if input_quantity > 0:   # If no matching and there's any quantity left, add it into orderbook
                try:
                    self.add_order({**order, "quantity": input_quantity})
                except Exception as e:
                    logging.error(f"Failed to add remaining quantity as new order for {self.symbol}: {e}")

        except Exception as e:
            logging.error(f"Unexpected error in match_order for {self.symbol}: {e}")
            raise