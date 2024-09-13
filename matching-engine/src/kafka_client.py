import asyncio
import os
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json
from decimal import Decimal
from dotenv import load_dotenv
import logging
import traceback
from aiokafka.errors import KafkaError


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

                logging.info("Successfully connected to Kafka")
                return
            except KafkaError as ke:
                if "NodeNotReadyError" in str(ke):
                    logging.error(f"Kafka node not ready (attempt {attempt + 1}/{max_retries}): {str(ke)}")
                elif "RequestTimedOutError" in str(ke):
                    logging.error(f"Request to Kafka timed out (attempt {attempt + 1}/{max_retries}): {str(ke)}")
                else:
                    logging.error(f"Kafka Error during setup (attempt {attempt + 1}/{max_retries}): {str(ke)}")
                logging.debug(traceback.format_exc())
            except Exception as e:
                logging.error(f"Unexpected error during setup (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logging.debug(traceback.format_exc())
            
            if attempt < max_retries - 1:
                logging.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            else:
                logging.error("Max retries reached. Failing to set up Kafka client.")
                raise
    
    async def connect(self):
        while self.should_run:
            try:
                await self.setup()
                return
            except Exception as e:
                logging.error(f"Failed to connect to Kafka: {str(e)}")
                logging.info("Retrying connection in 10 seconds...")
                await asyncio.sleep(10)
    
    # Continuously consume messages from subscribed topics
    async def consume_messages(self):
        while True:
            try:
                async for msg in self.consumer:
                    if msg.topic in self.topic_handlers:
                        try:
                            await self.topic_handlers[msg.topic](msg.value)
                        except Exception as handler_error:
                            logging.error(f"Error in topic handler for {msg.topic}: {str(handler_error)}")
                            logging.debug(traceback.format_exc())
            except KafkaError as ke:
                logging.error(f"Kafka Error in consume_messages: {str(ke)}")
                logging.debug(traceback.format_exc())
                await self.reconnect()
            except Exception as e:
                logging.error(f"Unexpected error in consume_messages: {str(e)}")
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
                return
            except KafkaError as ke:
                logging.error(f"Kafka Error in produce_result (attempt {attempt + 1}/{max_retries}): {str(ke)}")
                logging.debug(traceback.format_exc())
            except Exception as e:
                logging.error(f"Unexpected error in produce_result (attempt {attempt + 1}/{max_retries}): {str(e)}")
                logging.debug(traceback.format_exc())
            
            if attempt < max_retries - 1:
                await asyncio.sleep(1)  # 等待一秒後重試
        
        logging.error(f"Failed to produce message to topic {topic} after {max_retries} attempts")

    async def close(self):
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logging.info("Kafka client closed successfully")
        except Exception as e:
            logging.error(f"Error while closing Kafka client: {str(e)}")
            logging.debug(traceback.format_exc())

    def add_topic_handler(self, topic, handler):
        self.topic_handlers[topic] = handler