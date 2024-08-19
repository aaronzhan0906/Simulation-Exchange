import express from "express";
import { wss } from "../app.js";
import WebSocket from "ws";

const router = express.Router();
const wsBaseUrl = process.env.WEBSOCKET_URL;
const streamName = "btcusdt@ticker";
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;
const btcusdtWs = new WebSocket(wsUrl);

let dataBuffer = [];
let latestTickerData = null;
let bufferInterval = null;

function broadcastMessage(type, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}


// random volatility just for demo to solve slow ws
function getRandomVolatility() {
  return (Math.random() - 0.0001) * 0.00001;
}

function processBuffer() {
  if (dataBuffer.length > 0) {
    const lastData = dataBuffer[dataBuffer.length - 1];
    const volatility = getRandomVolatility();
    
    const originalPrice = parseFloat(lastData.price);
    const newPrice = originalPrice * (1 + volatility);
    
    const enhancedData = {
      symbol: lastData.symbol,
      price: newPrice.toFixed(2),
      priceChangePercent: lastData.priceChangePercent,
    };
    
    dataBuffer = [];
    broadcastMessage("ticker", enhancedData);
  }
}

btcusdtWs.on("open", () => {
  console.log("WebSocket connection established");
  bufferInterval = setInterval(processBuffer, 1000);
});

btcusdtWs.on("message", (data) => {
  const parsedData = JSON.parse(data);
  const { stream, data: streamData } = parsedData;

  if (stream === "btcusdt@ticker") {
    latestTickerData = {
      symbol: streamData.s,
      price: streamData.c,
      priceChangePercent: streamData.P,
    };
    dataBuffer.push(latestTickerData);
  }
});

btcusdtWs.on("error", (error) => {
  console.error("WebSocket error:", error);
});

btcusdtWs.on("close", () => {
  console.log("WebSocket connection closed");
  if (bufferInterval) {
    clearInterval(bufferInterval);
  }
});

process.on("SIGINT", () => {
  if (bufferInterval) {
    clearInterval(bufferInterval);
  }
  if (btcusdtWs.readyState === WebSocket.OPEN) {
    btcusdtWs.close();
  }
  process.exit();
});

export default router;


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
