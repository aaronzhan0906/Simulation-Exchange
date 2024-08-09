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
        await consumer.subscribe({ topic: "trade_result", fromBeginning: true });
        await consumer.subscribe({ topic: "order_book_snapshot", fromBeginning: true })

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                const data = JSON.parse(message.value.toString());
                
                switch (topic) {
                    case "trade_result":
                        console.log("trade_result received:", data);
                        TradeController.createTradeHistory(data);
                        TradeController.updateOrderData(data);
                        break;

                    case "order_book_snapshot":
                        console.log("order_book_snapshot received:", data);
                        break;

                    default:
                        console.log(`Received message from unknown top: ${topic}`);
                }
            },
        });
        console.log("Kafka consumer connected and subscribed");
    },
}

