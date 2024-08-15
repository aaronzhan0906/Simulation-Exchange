import { Kafka, logLevel } from "kafkajs";
import config from "../config/config.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.INFO
});

const producer = kafka.producer();
const admin = kafka.admin();

const requiredTopics = ["new-orders", "cancel-orders", "trade_result", "order_book_snapshot", "cancel_result"];

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

const createTopicsIfNotExists = async () => {
    console.log("Attempting to create topics...");
    await admin.connect();
    try {
        const existingTopics = await admin.listTopics();
        console.log("Existing topics:", existingTopics);
        
        const topicsToBeCreated = requiredTopics.filter(topic => !existingTopics.includes(topic));
        console.log("Topics to create:", topicsToBeCreated);
        
        if (topicsToBeCreated.length > 0) {
            await admin.createTopics({
                topics: topicsToBeCreated.map(topic => ({ topic, numPartitions: 1, replicationFactor: 1 }))
            });
            console.log(`Created topics: ${topicsToBeCreated.join(', ')}`);
        } else {
            console.log("All required topics already exist");
        }
    } finally {
        await admin.disconnect();
    }
};

export default {
    init: async () => {
        await retryOperation(async () => {
            await createTopicsIfNotExists();
            await producer.connect();
            console.log("Kafka producer connected and topics created");
        });
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
