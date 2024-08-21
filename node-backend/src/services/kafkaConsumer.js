import { Kafka } from "kafkajs";
import config from "../config/config.js";
import TradeController from "../controllers/tradeController.js";
import { pendingCancelResults } from "../controllers/tradeController.js";

const supportedSymbols = config.supportedSymbols;
const createKafkaClient = () => new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});

const connectWithRetry = async (kafka, maxRetries = 15, retryDelay = 10000) => {
    const consumer = kafka.consumer({ groupId: config.kafka.groupId });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await consumer.connect();
            console.log("Successfully connected to Kafka");
            return consumer;
        } catch (error) {
            console.error(`Failed to connect to Kafka (attempt ${attempt}/${maxRetries}):`, error.message);
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

const subscribeToTopics = async (consumer) => {
    for (const symbol of supportedSymbols){
        await consumer.subscribe({ topic: `trade_result_${symbol}`, fromBeginning: true });
        await consumer.subscribe({ topic: `order_book_snapshot_${symbol}`, fromBeginning: true });
        await consumer.subscribe({ topic: `cancel_result_${symbol}`, fromBeginning: true });
    }
};

const handleMessage = async ({ topic, message }) => {
    const data = JSON.parse(message.value.toString());
    const topicParts = topic.split("_");
    const topicType = topicParts.slice(0, -1).join("_");
    const symbol = topicParts[topicParts.length - 1];

    switch (topicType) {
        case "trade_result":
            console.log(`(CONSUMER)trade_result_${symbol}:`, data);
            await TradeController.createTradeHistory(data);
            await TradeController.updateOrderData(data);
            await TradeController.broadcastRecentTrade(data);
            break;

        case "order_book_snapshot":
            console.log(`(CONSUMER)order_book:_${symbol}`, data);
            await TradeController.broadcastOrderBook(data, symbol);
            break;

        case "cancel_result":
            console.log(`(CONSUMER)cancel_result_${symbol}:`, data);
            const { order_id } = data;
            if (pendingCancelResults.has(order_id)){
                const { resolve } = pendingCancelResults.get(order_id); 
                resolve(data);
                pendingCancelResults.delete(order_id);
            }
            break;

        default:
            console.log(`Received message from unknown topic: ${topic}`);
    }
};

export default {
    init: async () => {
        const kafka = createKafkaClient();
        const consumer = await connectWithRetry(kafka);

        await subscribeToTopics(consumer);

        await consumer.run({
            eachMessage: async (payload) => {
                try {
                    await handleMessage(payload);
                } catch (error) {
                    console.error("Error processing message:", error);
                }
            },
        });

        console.log("Kafka consumer connected and subscribed");

        const gracefulShutdown = async () => {
            try {
                await consumer.disconnect();
                console.log("Kafka consumer disconnected");
                process.exit(0);
            } catch (error) {
                console.error("Error during graceful shutdown:", error);
                process.exit(1);
            }
        };

        process.on("SIGINT", gracefulShutdown);  // ctrl + c
        process.on("SIGTERM", gracefulShutdown); // docker stop
    },
};