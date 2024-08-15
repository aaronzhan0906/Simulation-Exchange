import asyncio
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json
from decimal import Decimal

class StringifyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (int, Decimal)):
            return str(obj)
        return super(StringifyEncoder, self).default(obj)

def stringify_serializer(obj):
    return json.dumps(obj, cls=StringifyEncoder).encode("utf-8")

class KafkaClient:
    def __init__(self, bootstrap_servers="kafka:9092"):
        self.bootstrap_servers = bootstrap_servers
        self.consumer = None
        self.producer = None
        self.topic_handlers = {}

    async def setup(self, max_retries=15, retry_delay=10):
        for attempt in range(max_retries):
            try:
                self.consumer = AIOKafkaConsumer(
                    "new-orders",
                    "cancel-orders",
                    bootstrap_servers=self.bootstrap_servers,
                    value_deserializer=lambda x: json.loads(x.decode("utf-8"))
                )
                await self.consumer.start()

                self.producer = AIOKafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=stringify_serializer
                )
                await self.producer.start()

                print("Successfully connected to Kafka")
                return
            except Exception as event:
                print(f"Failed to connect to Kafka (attempt {attempt + 1}/{max_retries}): {str(event)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    raise

    async def consume_messages(self):
        try:
            async for msg in self.consumer:
                if msg.topic in self.topic_handlers:
                    await self.topic_handlers[msg.topic](msg.value)
        except Exception as event:
            print(f"Error in consume_messages: {str(event)}")

    async def produce_result(self, topic, data):
        try:
            await self.producer.send(topic, data)
        except Exception as event:
            print(f"Error in produce_result: {str(event)}")

    async def close(self):
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()

    def add_topic_handler(self, topic, handler):
        self.topic_handlers[topic] = handler