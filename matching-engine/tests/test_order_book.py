import pytest
from decimal import Decimal
from src.order_book import OrderBook
from sortedcontainers import SortedDict
from unittest.mock import patch
 

class TestOrderBook:
    @pytest.fixture(autouse=True) # fixture 自動用於所有測試，預設的 function scope，每個測試方法都會重新執行 
    def setup(self, monkeypatch):
        """
        設置測試環境，autouse=True 使每個測試自動使用此 fixture
        The monkeypatch fixture helps you to safely set/delete 
        an attribute, dictionary item or environment variable
        """
        # monkeypathch set env
        monkeypatch.setenv("REDIS_HOST", "localhost")
        monkeypatch.setenv("REDIS_PORT", "6379")
        monkeypatch.setenv("REDIS_DB", "0")

        # init
        self.order_book = OrderBook(symbol="TEST")
        self.order_book.bids = SortedDict()
        self.order_book.asks = SortedDict()
        
        # Mock Redis 
        self.redis_patcher = patch("redis.StrictRedis") # 創建 mock 物件，確保測試不會受到外部系統狀態或可用性的影響
        mock_redis = self.redis_patcher.start() # 啟動 mock 物件，取得 mock 物件
        mock_redis.return_value.get.return_value = None # 回傳 None，目前的測試不需要

        # 預定義常用的測試訂單
        self.basic_buy_order = {
            "order_id": "123",
            "user_id": "11111111111",
            "side": "buy",
            "price": "100.50",
            "quantity": "10.0"
        }

        self.second_buy_order = {
            "order_id": "987",
            "user_id": "2222222222",
            "side": "buy",
            "price": "100.50",
            "quantity": "10.0"
        }
        
        self.basic_sell_order = {
            "order_id": "54321",
            "user_id": "9999999999",
            "side": "sell",
            "price": "100.00",
            "quantity": "10.0"
        }
        
        self.matching_buy_order = {
            "order_id": "12345",
            "user_id": "8888888888",
            "side": "buy",
            "price": "101.00",
            "quantity": "5.0"
        }

    def teardown_method(self): # 自動調用
       """每次測試都需要新的 mock 環境，所以要在測試結束時清理之前的 mock"""
       self.redis_patcher.stop() 

    def test_add_order(self):
        """測試添加訂單功能"""
        # Arrange - 在 setup 已完成初始化

        # Act - 添加訂單
        self.order_book.add_order(self.basic_buy_order)
        
        # Assert - 驗證添加結果
        price_level = Decimal(self.basic_buy_order["price"])
        
        assert price_level in self.order_book.bids
        assert self.basic_buy_order["order_id"] in self.order_book.bids[price_level]
        assert self.order_book.bids[price_level][self.basic_buy_order["order_id"]] == (
            Decimal(self.basic_buy_order["quantity"]),
            Decimal(self.basic_buy_order["quantity"]),
            self.basic_buy_order["user_id"]
        )

    def test_cancel_order(self):
        """測試取消訂單功能"""
        # Arrange - 加入 basic_buy_order
        self.order_book.add_order(self.basic_buy_order)
        self.order_book.add_order(self.second_buy_order)
        
        # Act - 調用 cancel_order
        cancel_result = self.order_book.cancel_order(
            self.basic_buy_order["order_id"],
            self.basic_buy_order["side"],
            self.basic_buy_order["price"]
        )
 
        
        # Assert - 驗證取消結果 
        assert cancel_result == (
            "buy",
            Decimal(self.basic_buy_order["price"]),
            Decimal("10.0"),
            Decimal("10.0"),
            "11111111111"
        )
        # in
        assert self.second_buy_order["order_id"] in self.order_book.bids[Decimal(self.basic_buy_order["price"])]
        # not in
        assert self.basic_buy_order["order_id"] not in self.order_book.bids[Decimal(self.basic_buy_order["price"])]
        
    def test_match_order(self):
        """測試完全匹配訂單功能"""
        # Arrange - 加入 basic_sell_order 並修改數量
        new_sell_order = dict(self.basic_sell_order)
        new_sell_order["quantity"] = "3.0"
        self.order_book.add_order(new_sell_order)

        # Act - 執行訂單匹配
        match_order_result = list(self.order_book.match_order(self.matching_buy_order))
        
        # Assert - 驗證匹配結果
        assert len(match_order_result) == 1
        assert match_order_result[0] == {
            "matched_order_id": "54321",
            "matched_user_id": "9999999999",
            "trade_quantity": Decimal("3.0"),
            "executed_price": Decimal("100.00"),
            "input_remaining_quantity": Decimal("2.0"),
            "matched_remaining_quantity": Decimal("0.0"),
            "input_price": Decimal("101.00"),
            "opposite_price": Decimal("100.00"),
            "input_user_id": "8888888888",
            "input_order_id": "12345"
        }
        assert Decimal("101.00") in self.order_book.bids
        assert Decimal("100.00") not in self.order_book.asks
