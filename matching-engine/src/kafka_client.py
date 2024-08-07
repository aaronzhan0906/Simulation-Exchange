from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json
from decimal import Decimal


# stringify decimal
class StringifyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (int, Decimal)):
            return str(obj)
        return super(StringifyEncoder, self).default(obj)
 
def stringify_serializer(obj):
    return json.dumps(obj, cls=StringifyEncoder).encode("utf-8")

class KafkaClient: 
    def __init__(self, bootstrap_servers="localhost:9092"):
        self.bootstrap_servers = bootstrap_servers
        self.consumer = None
        self.producer = None

    async def setup(self):
        self.consumer = AIOKafkaConsumer(
            "new-orders",
            "completed-transactions",
            bootstrap_servers = self.bootstrap_servers,
            value_deserializer=lambda x: json.loads(x.decode("utf-8"))
        )
        await self.consumer.start()

        self.producer = AIOKafkaProducer(
            bootstrap_servers = self.bootstrap_servers,
            value_serializer = stringify_serializer
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