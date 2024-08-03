import { Kafka } from 'kafkajs';
import kafkaConfig from '../config/kafka.js';

const kafka = new Kafka(kafkaConfig);
const consumer = kafka.consumer({ groupId: kafkaConfig.groupId });

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

