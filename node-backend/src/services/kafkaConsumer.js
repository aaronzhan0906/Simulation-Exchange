import { Kafka } from 'kafkajs';
import config from '../config/config.js';
import TradeController from "../controllers/tradeController.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});

const consumer = kafka.consumer({ groupId: config.kafka.groupId });

export default {
    init: async() => {
        await consumer.connect();
        await consumer.subscribe({ topic: "processed-orders", fromBeginning: true });
        await consumer.subscribe({ topic: "completed-transactions", fromBeginning: true })

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const data = JSON.parse(message.value.toString());
                
                switch (topic) {
                    case "processed-orders":
                        console.log("Processed order received:", data);
                        break;

                    case "completed-transactions":
                        console.log("Completed transaction received:", data);
                        await TradeController.processCompletedTransaction(data);
                        break;

                    default:
                        console.log(`Received message from unknown top: ${topic}`);
                }
            },
        });
        console.log("Kafka consumer connected and subscribed");
    },
}

