import asyncio
import os
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json
from decimal import Decimal
from dotenv import load_dotenv
import logging


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

    async def setup(self, max_retries=15, retry_delay=10):
        for attempt in range(max_retries):
            try:
                topics_to_subscribe = [f"new-order-{symbol}" for symbol in SUPPORTED_SYMBOLS] + \
                                    [f"cancel-order-{symbol}" for symbol in SUPPORTED_SYMBOLS]

                self.consumer = AIOKafkaConsumer(
                    *topics_to_subscribe,
                    bootstrap_servers=self.bootstrap_servers,
                    value_deserializer=lambda x: json.loads(x.decode("utf-8"))
                )
                await self.consumer.start()

                self.producer = AIOKafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=stringify_serializer
                )
                await self.producer.start()

                logging.info("Successfully connected to Kafka")
                return
            except Exception as event:
                logging.error(f"Failed to connect to Kafka (attempt {attempt + 1}/{max_retries}): {str(event)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    raise
    
    # Continuously consume messages from subscribed topics
    async def consume_messages(self):
        try:
            async for msg in self.consumer:
                if msg.topic in self.topic_handlers:
                    try:
                        await self.topic_handlers[msg.topic](msg.value)
                    except Exception as handler_error:
                        logging.error(f"Error in topic handler for {msg.topic}: {str(handler_error)}")
                        import traceback
                        logging.error(traceback.format_exc())
        except Exception as e:
            print(f"Error in consume_messages: {str(e)}")
            import traceback
            print(traceback.format_exc())

    async def produce_result(self, topic, data):
        try:
            await self.producer.send(topic, data)
        except Exception as e:
            print(f"Error in produce_result: {str(e)}")

    async def close(self):
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()

    def add_topic_handler(self, topic, handler):
        self.topic_handlers[topic] = handler