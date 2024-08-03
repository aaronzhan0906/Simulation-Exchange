import { Kafka } from "kafkajs";
import config from "../config/config.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});

const producer = kafka.producer();

export default {
    init: async () => {
        try {
            await producer.connect();
            console.log("Kafka producer connected");
        } catch (error) {
            console.error("Error connecting Kafka producer:", error);
            throw error;
        }
    },
    
    sendMessage: async (topic, message) => {
        try {
            const result = await producer.send({
                topic: topic,
                messages: [{ value: JSON.stringify(message) }],
            });
            console.log(`Message sent successfully to topic ${topic}`);
            return result;
        } catch (error) {
            console.error(`Error sending message to topic ${topic}:`, error);
            throw error; 
        }
    },

    disconnect: async () => {
        try {
            await producer.disconnect();
            console.log("Kafka producer disconnected");
        } catch (error) {
            console.error("Error disconnecting Kafka producer:", error);
        }
    }
};