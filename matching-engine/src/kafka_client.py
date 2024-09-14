import asyncio
import os
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json
from decimal import Decimal
from dotenv import load_dotenv
import logging
import traceback
from aiokafka.errors import KafkaError, KafkaConnectionError, NodeNotReadyError, RequestTimedOutError


load_dotenv()
SUPPORTED_SYMBOLS = os.environ.get("SUPPORTED_SYMBOLS", "btc,eth,bnb,sol,avax").split(',')
SUPPORTED_SYMBOLS = [symbol.strip() for symbol in SUPPORTED_SYMBOLS]

# Convert decoimal and int objects to strings for JSON serialization
class StringifyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (int, Decimal)):
            return str(obj)
        return super(StringifyEncoder, self).default(obj)

# Serialize the object to JSON string using StringifyEncoder
def stringify_serializer(obj):
    return json.dumps(obj, cls=StringifyEncoder).encode("utf-8")

# Initialize and start the Kafka consumer and producer
class KafkaClient:
    def __init__(self, bootstrap_servers=None):
        self.bootstrap_servers = bootstrap_servers or os.environ.get("KAFKA_BROKERS", "localhost:9092")
        self.consumer = None
        self.producer = None
        self.topic_handlers = {}
        self.should_run = True

    async def setup(self, max_retries=15, retry_delay=10):
        for attempt in range(max_retries):
            try:
                topics_to_subscribe = [f"new-order-{symbol}" for symbol in SUPPORTED_SYMBOLS] + \
                                    [f"cancel-order-{symbol}" for symbol in SUPPORTED_SYMBOLS]

                self.consumer = AIOKafkaConsumer(
                    *topics_to_subscribe,
                    bootstrap_servers=self.bootstrap_servers,
                    value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                    request_timeout_ms=30000,
                    retry_backoff_ms=1000
                )
                await self.consumer.start()

                self.producer = AIOKafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=stringify_serializer,
                    request_timeout_ms=30000,
                    retry_backoff_ms=1000
                )
                await self.producer.start()

                logging.info("成功連接到 Kafka")
                return
            except NodeNotReadyError as nre:
                logging.error(f"Kafka 節點未就緒 (嘗試 {attempt + 1}/{max_retries}): {str(nre)}")
            except RequestTimedOutError as rte:
                logging.error(f"Kafka 請求超時 (嘗試 {attempt + 1}/{max_retries}): {str(rte)}")
            except KafkaConnectionError as kce:
                logging.error(f"Kafka 連接錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(kce)}")
            except KafkaError as ke:
                logging.error(f"Kafka 錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(ke)}")
            except Exception as e:
                logging.error(f"設置過程中發生意外錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(e)}")
            
            logging.debug(traceback.format_exc())
            
            if attempt < max_retries - 1:
                logging.info(f"{retry_delay} 秒後重試...")
                await asyncio.sleep(retry_delay)
            else:
                logging.error("達到最大重試次數。無法設置 Kafka 客戶端。")
                raise
    
    async def connect(self):
        while self.should_run:
            try:
                await self.setup()
                return
            except Exception as e:
                logging.error(f"連接到 Kafka 失敗: {str(e)}")
                logging.info("10 秒後重試連接...")
                await asyncio.sleep(10)
    
    # Continuously consume messages from subscribed topics
    async def consume_messages(self):
        while self.should_run:
            try:
                async for msg in self.consumer:
                    if msg.topic in self.topic_handlers:
                        try:
                            await self.topic_handlers[msg.topic](msg.value)
                        except Exception as handler_error:
                            logging.error(f"{msg.topic} 的主題處理器發生錯誤: {str(handler_error)}")
                            logging.debug(traceback.format_exc())
            except KafkaConnectionError as kce:
                logging.error(f"Kafka 連接錯誤: {str(kce)}")
                await self.reconnect()
            except RequestTimedOutError as rte:
                logging.error(f"Kafka 請求超時: {str(rte)}")
                await self.reconnect()
            except KafkaError as ke:
                logging.error(f"Kafka 錯誤: {str(ke)}")
                await self.reconnect()
            except Exception as e:
                logging.error(f"消費消息時發生意外錯誤: {str(e)}")
                logging.debug(traceback.format_exc())
                await self.reconnect()

    async def reconnect(self):
        logging.info("Attempting to reconnect to Kafka...")
        await self.close()
        await self.connect()

    async def produce_result(self, topic, data):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                await self.producer.send(topic, data)
                logging.info(f"Sent {topic}")
                return
            except KafkaConnectionError as kce:
                logging.error(f"發送消息時發生 Kafka 連接錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(kce)}")
            except RequestTimedOutError as rte:
                logging.error(f"發送消息時請求超時 (嘗試 {attempt + 1}/{max_retries}): {str(rte)}")
            except KafkaError as ke:
                logging.error(f"發送消息時發生 Kafka 錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(ke)}")
            except Exception as e:
                logging.error(f"發送消息時發生意外錯誤 (嘗試 {attempt + 1}/{max_retries}): {str(e)}")
            
            logging.debug(traceback.format_exc())
            
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
        
        logging.error(f"在 {max_retries} 次嘗試後無法將消息發送到主題 {topic}")

    async def close(self):
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logging.info("Kafka 客戶端成功關閉")
        except KafkaError as ke:
            logging.error(f"關閉 Kafka 客戶端時發生 Kafka 錯誤: {str(ke)}")
        except Exception as e:
            logging.error(f"關閉 Kafka 客戶端時發生意外錯誤: {str(e)}")
        logging.debug(traceback.format_exc())

    def add_topic_handler(self, topic, handler):
        self.topic_handlers[topic] = handler