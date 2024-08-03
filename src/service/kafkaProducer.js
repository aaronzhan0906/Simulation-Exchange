import { Kafka } from "kafkajs";
import kafkaConfig from "../config/kafka.js";

const kafka = new Kafka(kafkaConfig);
const producer = kafka.producer();

export default {
    init: async () => {
        await producer.connect();
        console.log("Kafka producer connected");
    },
    
    sendMessage: async (topic, message) => {
        await producer.send({
            topic: topic,
            messages: [{ value: JSON.stringify(message) }],
        });
    },
};

