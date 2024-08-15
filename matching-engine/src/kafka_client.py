import asyncio
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
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
        self.admin_client = None

    async def create_topics(self, topics, max_retries=5, retry_delay=5):
        for attempt in range(max_retries):
            try:
                self.admin_client = AIOKafkaAdminClient(
                    bootstrap_servers=self.bootstrap_servers
                )
                await self.admin_client.start()
                
                existing_topics = await self.admin_client.list_topics()
                topics_to_create = [topic for topic in topics if topic not in existing_topics]
                
                if topics_to_create:
                    new_topics = [NewTopic(name=topic, num_partitions=1, replication_factor=1) for topic in topics_to_create]
                    await self.admin_client.create_topics(new_topics)
                    print(f"Created topics: {topics_to_create}")
                else:
                    print("All required topics already exist")
                
                await self.admin_client.close()
                return
            except Exception as e:
                print(f"Failed to create topics (attempt {attempt + 1}/{max_retries}): {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    raise

    async def setup(self, max_retries=15, retry_delay=10):
        # 首先創建主題
        topics_to_create = ["new-orders", "cancel-orders", "trade_result"]
        await self.create_topics(topics_to_create)

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
            except Exception as e:
                print(f"Failed to connect to Kafka (attempt {attempt + 1}/{max_retries}): {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    raise

    async def consume_messages(self):
        try:
            async for msg in self.consumer:
                if msg.topic in self.topic_handlers:
                    await self.topic_handlers[msg.topic](msg.value)
        except Exception as e:
            print(f"Error in consume_messages: {str(e)}")
            # 可以在這裡添加重新連接邏輯

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