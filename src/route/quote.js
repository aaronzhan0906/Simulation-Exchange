import express from "express";
import config from "../config/config.js";
import WebSocket from "ws";

const router = express.Router();

const streamName = "btcusdt@ticker/btcusdt@depth";
const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamName}`;
const btcusdtWs = new WebSocket(wsUrl)

let latestTickerData = null;
let latestDepthData = { bids: {}, asks: {}};


// get ticker and order book from binance
btcusdtWs.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data:streamData } = parsedData;

    // ticker
    if ( stream === "btcusdt@ticker") {
        latestTickerData = {
            Symbol: streamData.s,
            price: streamData.c,
            priceChange: streamData.p,
            priceChangePercent: streamData.p,
            high: streamData.h,
            low: streamData.l,
            volume: streamData.v
        }
    } else if (stream === "btcusdt@depth") {
        // renew bid
        streamData.b.forEach(([price, quantity]) => {
            if (parseFloat(quantity) === 0){
                delete latestDepthData[price];
            } else {
                latestDepthData.bids[price] = parseFloat(quantity);
            }
        });

        streamData.a.forEach(([price, quantity]) => {
            if (parseFloat(quantity) === 0){
                delete latestDepthData.asks[price];
            } else {
                latestDepthData.asks[price] = parseFloat(quantity);
            }
        })
    }
})

btcusdtWs.on("error",(error)=>{
    console.error("Websocket error:", error)
})


// GET latest-ticker //
router.get("/latest-ticker",(req, res)=> {
    if (latestTickerData) {
        res.json(latestTickerData);
    } else {
        res.status(503).json({error: "ok", message:"Ticker data not available yet"});
    }
});


// GET latest-ticker //
router.get("/order-book",(req, res) => {
    const myExchangeData = getMyExchangeOrderBook();

    const combineAsks = { ... latestDepthData.asks, ... myExchangeData.asks };
    const combineBids = { ... latestDepthData.bids, ... myExchangeData.bids };
    const processedData = {
        asks: Object.entries(combineAsks)
        .sort((a, b) => parseFloat(b[0] - parseFloat(a[0]))).slice(0, 10).map(([price, quantity]) => [parseFloat(price), quantity]),
        bids: Object.entries(combineBids)
        .sort((a, b) => parseFloat(b[0] - parseFloat(a[0]))).slice(0, 10).map(([price, quantity]) => [parseFloat(price), quantity])
    }

    if (Object.keys(latestDepthData.bids).length > 0 || Object.keys(latestDepthData.asks).length > 0) {
        res.json({processedData});
    } else {
        res.status(503).json({ error:"ok", message:"Order book data not available yet"})
    }
});

router.get("/ws-status",(req, res) => {
    res.json({
        connected: btcusdtWs.readyState === WebSocket.OPEN
    });
});


// getMyExchangeOrderBook
async function getMyExchangeOrderBook () {
    return null;
}


export default router;