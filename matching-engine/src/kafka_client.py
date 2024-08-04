from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json

class KafkaClient: 
    def __init__(self, bootstrap_servers="localhost:9292"):
        self.bootstrap_servers = bootstrap_servers
        self.consumer = None
        self.producer = None

    async def setup(self):
        self.consumer = AIOKafkaConsumer(
            "incoming_orders",
            bootstrap_servers = self.bootstrap_servers,
            value_deserializer=lambda x: json.loads(x.decode("utf-8"))
        )
        await self.consumer.start()

        self.producer = AIOKafkaProducer(
            bootstrap_servers = self.bootstrap_servers,
            value_serializer = lambda x: json.dumps(x).encode("utf-8")
        )
        await self.producer.start()

    async def consume_orders(self):
        async for msg in self.consumer:
            yield msg.value

    async def produce_result(self, topic, data):
        await self.producer.send(topic, data)

    async def close(self):
        await self.consumer.stop()
        await self.producer.stop()