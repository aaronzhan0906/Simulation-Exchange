import express from "express";
import WebSocket from "ws";
import config from "../config/config.js";
import WebSocketService from "../services/websocketService.js";


const router = express.Router();

const wsBaseUrl = process.env.WSS_BINANCE_URL;
const supportedSymbols = config.supportedSymbols;
const tradingPairs = supportedSymbols.map(symbol => `${symbol}usdt`);   
const streamName = tradingPairs.map(pair => `${pair}@ticker`).join('/');
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;

const binanceWs = new WebSocket(wsUrl);

let latestTickerData = {};

// broadcast function by condition
function broadcastMessage(type, data) {
    WebSocketService.broadcastToAllSubscribers({ type, data })
}

// get ticker from binance wss
binanceWs.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data: streamData } = parsedData;

    // Extract the trading pair from the stream name
    const pair = stream.split("@")[0].toUpperCase();

    latestTickerData[pair] = {
        symbol: streamData.s,
        price: streamData.c,
        priceChangePercent: streamData.P,
    };
    broadcastMessage(`ticker${pair.replace("USDT", "")}`, latestTickerData[pair]);
});

binanceWs.on("error", (error) => {
    console.error("Websocket error:", error);
});

// router to get the latest ticker data
router.get("latest-ticker", (req, res) => {
    res.json(latestTickerData);
});

export default router;

// let latestDepthData = { bids: {}, asks: {}};

// const processedData = processOrderBookData();
// broadcastMessage("orderBook", processedData)

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
