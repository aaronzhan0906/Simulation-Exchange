import express from "express";
import { wss } from "../app.js";
import WebSocket from "ws";

const router = express.Router();

const wsBaseUrl = process.env.WEBSOCKET_URL 
const streamName = "btcusdt@ticker/btcusdt@depth";
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;
const btcusdtWs = new WebSocket(wsUrl)

let latestTickerData = null;
// let latestDepthData = { bids: {}, asks: {}};

// store 15 seconds data
const dataBuffer = [];
const BUFFER_SIZE = 15; 

// broadcast function
function broadcastMessage(type ,data) {
    wss.clients.forEach((client)=> {
        if (client.readyState === WebSocket.OPEN){
            client.send(JSON.stringify({type ,data}));
        }
    });
}

function processBufferData(newData) {
    dataBuffer.push(newData);
    if (dataBuffer.length > BUFFER_SIZE) {
        dataBuffer.shift();
    }
    return dataBuffer[dataBuffer.length - 1]; // 返回最後一個元素
}


// get ticker and order book from binance wss
btcusdtWs.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data:streamData } = parsedData;

    // ticker
    if ( stream === "btcusdt@ticker") {
        latestTickerData = {
            Symbol: streamData.s,
            price: streamData.c,
            priceChangePercent: streamData.P,
        }
        const processedData = processBufferData(latestTickerData);
        broadcastMessage("ticker", processedData);
 }
    // } else if (stream === "btcusdt@depth") {
    //     // renew bid
    //     streamData.b.forEach(([price, quantity]) => {
    //         if (parseFloat(quantity) === 0){
    //             delete latestDepthData[price];
    //         } else {
    //             latestDepthData.bids[price] = parseFloat(quantity);
    //         }
    //     });

    //     streamData.a.forEach(([price, quantity]) => {
    //         if (parseFloat(quantity) === 0){
    //             delete latestDepthData.asks[price];
    //         } else {
    //             latestDepthData.asks[price] = parseFloat(quantity);
    //         }
    //     })

    //     const processedData = processBufferData(latestDepthData);
    //     broadcastMessage("orderBook", processedData)
    // }
})

btcusdtWs.on("error",(error)=>{
    console.error("Websocket error:", error)
})
// function processOrderBookData(){
//     const myExchangeData = getMyExchangeOrderBook();
    
//     const combineAsks = { ... latestDepthData.asks, ... myExchangeData.asks };
//     const combineBids = { ... latestDepthData.bids, ... myExchangeData.bids };
//     const processedData = {
//         asks: Object.entries(combineAsks)
//         .sort((a, b) => parseFloat(a[0] - parseFloat(b[0]))).slice(0, 10).map(([price, quantity]) => [parseFloat(price), quantity]),
//         bids: Object.entries(combineBids)
//         .sort((a, b) => parseFloat(b[0] - parseFloat(a[0]))).slice(0, 10).map(([price, quantity]) => [parseFloat(price), quantity])
//     }
//     return processedData;
// }


// getMyExchangeOrderBook
// async function getMyExchangeOrderBook () {
//     return { bids: {}, asks: {} };
// }

// export 
export default router;