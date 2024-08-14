import { Kafka } from "kafkajs";
import config from "../config/config.js";
import TradeController from "../controllers/tradeController.js";
import { pendingCancelResults } from "../controllers/tradeController.js";

const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers
});

const consumer = kafka.consumer({ groupId: config.kafka.groupId });

export default {
    init: async() => {
        await consumer.connect();
        await consumer.subscribe({ topic: "trade_result", fromBeginning: true });
        await consumer.subscribe({ topic: "order_book_snapshot", fromBeginning: true });
        await consumer.subscribe({ topic: "cancel_result", fromBeginning: true});

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                const data = JSON.parse(message.value.toString());
                
                switch (topic) {
                    case "trade_result":
                        console.log("(CONSUMER)trade_result:", data);
                        TradeController.createTradeHistory(data);
                        TradeController.updateOrderData(data);
                        TradeController.broadcastRecentTrade(data);
                        break;

                    case "order_book_snapshot":
                        console.log("(CONSUMER)order_book_snapshot:", data);
                        break;

                    case "cancel_result":
                        console.log("(CONSUMER)Cancel result:", data);
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
            },
        });
        console.log("Kafka consumer connected and subscribed");
    },
}

