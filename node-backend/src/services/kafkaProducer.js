import { Kafka, logLevel } from "kafkajs";
import config from "../config/config.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.INFO
});

const producer = kafka.producer();

const retryOperation = async (operation, maxRetries = 5, delay = 5000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

export default {
    init: async () => {
        await producer.connect();
        console.log("Kafka producer connected");
    },

    sendMessage: async (topic, message) => {
        return retryOperation(async () => {
            const result = await producer.send({
                topic: topic,
                messages: [{ value: JSON.stringify(message) }],
            });
            console.log(`Message sent successfully to topic ${topic}`);
            return result;
        });
    },

    disconnect: async () => {
        await producer.disconnect();
        console.log("Kafka producer disconnected");
    }
};