import { Kafka } from 'kafkajs';
import config from '../config/config.js';

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});
const consumer = kafka.consumer({ groupId: config.kafka.groupId });

export default {
    init: async() => {
        await consumer.connect();
        await consumer.subscribe({ topic: "processed-orders", fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const orderData = JSON.parse(message.value.toString());
                console.log("Processed order received:", orderData);
            },
        });
        console.log('Kafka consumer connected and subscribed');
    },
}

