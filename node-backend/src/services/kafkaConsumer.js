import { Kafka } from "kafkajs";
import config from "../config/config.js";
import TradeController from "../controllers/tradeController.js";
import { logger } from "../app.js";


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
            logger.info("Successfully connected to Kafka");
            return consumer;
        } catch (error) {
            logger.error(`Failed to connect to Kafka (attempt ${attempt}/${maxRetries}):`, error.message);
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

const subscribeToTopics = async (consumer) => {
    for (const symbol of supportedSymbols){
        await consumer.subscribe({ topic: `trade-result-${symbol}`, fromBeginning: true });
        await consumer.subscribe({ topic: `order-book-snapshot-${symbol}`, fromBeginning: true });
        await consumer.subscribe({ topic: `cancel-result-${symbol}`, fromBeginning: true });
    }
};

const handleMessage = async ({ topic, message }) => {
    try {
        const data = JSON.parse(message.value.toString());
        const topicParts = topic.split("-");
        const topicType = topicParts.slice(0, -1).join("-"); // XXX-YYY-ZZZ -> XXX-YYY
        const symbol = topicParts[topicParts.length - 1];

        switch (topicType) {
            case "trade-result":
                logger.info(`(CONSUMER)trade-result-${symbol}:`, data);
                await TradeController.createTradeHistory(data);
                await TradeController.updateOrderData(data);
                await TradeController.broadcastRecentTradeToRoom(data, symbol);
                break;

            case "order-book-snapshot":
                // console.log(`(CONSUMER)order-book-snapshot-${symbol}`, data);
                await TradeController.broadcastOrderBookToRoom(data, symbol);
                break;

            case "cancel-result":
                // console.log(`(CONSUMER)cancel-result-${symbol}:`, data);
                await TradeController.handleCancelResult(data);
                break;

            default:
                logger.warn({ topic }, "Received message from unknown topic");
        } 
    } catch (error) {
        logger.error({ error: error.message, topic, partition }, "Error processing Kafka message");
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
                    logger.error({ error: error.message, topic: payload.topic, partition: payload.partition }, "Error processing message");
                }
            },
        });

        logger.info("Kafka consumer connected and subscribed");

        const gracefulShutdown = async () => {
            try {
                await consumer.disconnect();
                logger.info("Kafka consumer disconnected");
                process.exit(0);
            } catch (error) {
                logger.fatal({ error: error.message }, "Fatal error in Kafka consumer initialization");
                process.exit(1);
            }
        };

        process.on("SIGINT", gracefulShutdown);  // ctrl + c
        process.on("SIGTERM", gracefulShutdown); // docker stop
    },
};