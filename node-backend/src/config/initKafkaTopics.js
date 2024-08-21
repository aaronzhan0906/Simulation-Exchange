import { Kafka, logLevel } from "kafkajs";
import config from "../config/config.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
});

// create an admin client to manage topics
const admin = kafka.admin();

const supportedSymbols = config.supportedSymbols;
const requiredTopics = [
    ...supportedSymbols.flatMap(symbol => [ // returns a new array formed by applying a given callback
        `trade-result-${symbol}`,
        `order-book-snapshot-${symbol}`,
        `cancel-result-${symbol}`,
        `new-order-${symbol}`,
        `cancel-order-${symbol}`
    ])
];

async function resetTopics() {
    await admin.connect();
    try {
        console.log("Fetching existing Kafka topics...");
        const existingTopics = await admin.listTopics();

        // Delete existing topics
        if (existingTopics.length > 0) {
            console.log("Deleting existing Kafka topics...");
            await admin.deleteTopics({
                topics: existingTopics
            });
            console.log("Waiting for topic deletion to complete...");
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds to ensure topics are fully deleted
        }

        // Create new topics
        console.log("Creating new Kafka topics...");
        await admin.createTopics({
            topics: requiredTopics.map(topic => ({
                topic,
                numPartitions: 1,
                replicationFactor: 1  
            }))
        });
        console.log("Kafka topics reset successfully");

        // List all topics after reset
        console.log("Listing all Kafka topics after reset:");
        const topicsAfterReset = await admin.listTopics();
        topicsAfterReset.forEach(topic => console.log(`Created - ${topic}`));

    } catch (error) {
        console.error("Error resetting Kafka topics:", error);
    } finally {
        await admin.disconnect();
    }
}

resetTopics().catch(console.error);