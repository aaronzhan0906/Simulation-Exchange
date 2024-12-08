import pytest
import asyncio
from decimal import Decimal
import sys
import os
import fakeredis
import mock

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from order_book import OrderBook

class TestOrderBook:
    @pytest.fixture(autouse=True)
    def setup_env(self):
        """環境變量"""
        os.environ.update({
            "REDIS_HOST": "localhost",
            "REDIS_PORT": "6379",
            "REDIS_DB": "0"
        })
        yield
       
        for key in ["REDIS_HOST", "REDIS_PORT", "REDIS_DB"]:
            os.environ.pop(key, None)

    @pytest.fixture
    def mock_redis(self):
        return fakeredis.FakeStrictRedis()

    @pytest.fixture
    def order_book(self, mock_redis):
        with mock.patch('redis.StrictRedis', return_value=mock_redis):
            return OrderBook("btc_usdt")

    def test_add_order(self, order_book):
        # Arrange
        test_order = {
            "side": "buy",
            "price": "10000.00",
            "quantity": "1.5",
            "order_id": "123",
            "user_id": "user1"
        }

        # Act
        order_book.add_order(test_order)

        # Assert
        assert Decimal("10000.00") in order_book.bids
        assert "123" in order_book.bids[Decimal("10000.00")]
        order_data = order_book.bids[Decimal("10000.00")]["123"]
        assert order_data[0] == Decimal("1.5")  # current quantity
        assert order_data[1] == Decimal("1.5")  # original quantity
        assert order_data[2] == "user1"  # user_id

    def test_match_orders(self, order_book):
        # Arrange
        buy_order = {
            "side": "buy",
            "price": "10000.00",
            "quantity": "1.5",
            "order_id": "123",
            "user_id": "buyer1"
        }
        sell_order = {
            "side": "sell",
            "price": "10000.00",
            "quantity": "1.0",
            "order_id": "456",
            "user_id": "seller1"
        }

        # Act
        order_book.add_order(sell_order)
        matches = list(order_book.match_order(buy_order))

        # Assert
        assert len(matches) == 1
        match = matches[0]
        assert match["matched_order_id"] == "456"
        assert match["trade_quantity"] == Decimal("1.0")
        assert match["executed_price"] == Decimal("10000.00")
        assert match["input_remaining_quantity"] == Decimal("0.5")

    def test_cancel_order(self, order_book):
        # Arrange
        test_order = {
            "side": "buy",
            "price": "10000.00",
            "quantity": "1.5",
            "order_id": "123",
            "user_id": "user1"
        }
        order_book.add_order(test_order)

        # Act
        result = order_book.cancel_order("123", "buy", "10000.00")

        # Assert
        assert result is not None
        assert result[0] == "buy"  # side
        assert result[1] == Decimal("10000.00")  # price
        assert result[2] == Decimal("1.5")  # current quantity
        assert result[3] == Decimal("1.5")  # original quantity
        assert result[4] == "user1"  # user_id
        assert Decimal("10000.00") not in order_book.bids