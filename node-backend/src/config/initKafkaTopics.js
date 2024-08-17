import { Kafka , logLevel } from "kafkajs";
import config from "../config/config.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.INFO
});

const admin = kafka.admin();

const requiredTopics = ["new-orders", "cancel-orders", "trade_result", "order_book_snapshot", "cancel_result"];

const createTopics = async () => {
    await admin.connect();
    try {
        console.log("Creating Kafka topics...");
        await admin.createTopics({
            topics: requiredTopics.map(topic => ({ topic, numPartitions: 1, replicationFactor: 1 }))
        });
        console.log("Kafka topics created successfully");
    } catch (error) {
        console.error("Error creating Kafka topics:", error);
    } finally {
        await admin.disconnect();
    }
};

createTopics().catch(console.error);