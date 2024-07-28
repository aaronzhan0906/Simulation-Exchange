import express from "express";
import config from "../config/config.js";
import WebSocket from "ws";

const router = express.Router();

const streamName = "btcusdt@ticker/btcusdt@depth";
const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamName}`;
const btcusdtWs = new WebSocket(wsUrl)

let latestTickerData = null;
let latestDepthData = { bids: {}, asks: {}};

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
        
        // keep only top 10 bids and asks
        latestDepthData.bids = Object.fromEntries(
            Object.entries(latestDepthData.bids).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 10)
        );
        latestDepthData.asks = Object.fromEntries(
            Object.entries(latestDepthData.asks).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).slice(0, 10)
        );
    }
})

btcusdtWs.on("error",(error)=>{
    console.error("Websocket error:", error)
})

router.get("/latest-ticker",(req, res)=> {
    if(latestTickerData){
        res.json(latestTickerData);
    } else {
        res.status(503).json({error: "Ticker data not available yet"});
    }
});

router.get("/order-book",(req, res) => {
    if (Object.keys(latestDepthData.bids).length > 0 || Object.keys(latestDepthData.asks).length > 0) {
        res.json({
            bids: Object.entries(latestDepthData.bids).sort((a, b) => b[0] - a[0]).slice(0, 10),
            asks: Object.entries(latestDepthData.asks).sort((a, b) => a[0] - b[0]).slice(0, 10)
        });
    } else {
        res.status(503).json({ error: "Order book data not available yet"})
    }
});

router.get("/ws-status",(req, res) => {
    res.json({
        connected: btcusdtWs.readyState === WebSocket.OPEN
    });
});

export default router;