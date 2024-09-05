import express from "express";
import WebSocket from "ws";
import Redis from "ioredis";
import config from "../config/config.js";
import WebSocketService from "./websocketService.js";
import schedule from "node-schedule";
// import pool from "../config/database.js";

const router = express.Router();
// Create Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || "172.31.23.16",
    port: process.env.REDIS_PORT || 6379,
    tls: process.env.REDIS_TLS === "true" ,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
});
  
  // Add connection listeners
redis.on("connect", () => {
    console.log("Successfully connected to Redis");
});
  
redis.on("error", (error) => {
    console.error("Redis connection error:", error);
});

const wsBaseUrl = process.env.WSS_BINANCE_URL;
const supportedSymbols = config.supportedSymbols;
const tradingPairs = supportedSymbols.map(symbol => `${symbol}usdt`);
const streamName = tradingPairs.map(pair => `${pair}@ticker`).join("/");
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;
const binanceWS = new WebSocket(wsUrl);

let latestTickerData = {}; // for different trading pairs { BNBUSDT: {symbol: 'BNBUSDT' price: '551.10000000',priceChangePercent: '-1.73' }
// store price at least once every 1s


/////////////////////////  WebSocket functions ///////////////////////// 
function broadcastMessageToAll(type, data) {
    WebSocketService.broadcastToAllSubscribers({ type, data });
}

function broadcastToRoom(symbol, data) {
    const roomSymbol = symbol.slice(0, -4).toLowerCase() + "_usdt";
    WebSocketService.broadcastToRoom(roomSymbol, { type: "ticker", ...data }); 
}

export async function updatePriceData(pair, price) {
    const formattedPair = pair.toUpperCase(); // XXXUSDT
    let priceChangePercent = await calculate24hChangePercent(formattedPair, price);

    const updatedData = {
        symbol: formattedPair,
        price: price,
        priceChangePercent: priceChangePercent
    };

    latestTickerData[formattedPair] = updatedData;

    broadcastMessageToAll("ticker", updatedData);
    broadcastToRoom(formattedPair, updatedData); // broadcastToRoom will convert pair to xxx_usdt

    // store every time
    await storePriceData(formattedPair, updatedData);
}


/////////////////////////  Redis functions ///////////////////////// 
async function storePriceData(pair, data) {
    try {
        const now = Date.now(); 
        const timestamp = new Date(now).toISOString(); 

        const storedData = {
            ...data,
            timestamp: timestamp 
        };

        await redis.zadd(
            `recent_price_data:${pair}`,
            now, 
            JSON.stringify(storedData)
        );

    } catch (error) {
        console.error(`Error storing price for ${pair}:`, error);
    }
}

export async function getLatestPriceData(pair) {
    const latestPrice = await redis.get(`latest_price:${pair}`);
    return latestPrice ? JSON.parse(latestPrice) : null;
}

async function calculate24hChangePercent(pair, currentPrice) {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0); // XX:00:00
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    try {
        const oldPriceData = await redis.zrevrangebyscore(
            `hourly_price_data:${pair}`, 
            '+inf',
            twentyFourHoursAgo.getTime(),
            "LIMIT", 0, 1 
        );

        const oldPriceObj = JSON.parse(oldPriceData[0]);
        const oldPrice = parseFloat(oldPriceObj.open);
        const changePercent = ((currentPrice - oldPrice) / oldPrice) * 100;

        return changePercent.toFixed(2);

    } catch (error) {
        console.error(`Error calculating 24h change percent for ${pair}:`, error);
        return "0.00";
    }
}

async function storeHourlyData() {
        const now = new Date();
        now.setUTCMinutes(0, 0, 0);
        const timestamp = now.toISOString(); 
        const currentTime = now.getTime();
    
        for (const pair of Object.keys(latestTickerData)) {
            const currentHourPrice = latestTickerData[pair].price;
    
            const hourlyData = JSON.stringify({
                timestamp: timestamp,
                open: currentHourPrice
            });
    
            try {
                await redis.zadd(`hourly_price_data:${pair}`, currentTime, hourlyData);
    
                const thirtyDaysAgo = currentTime - 30 * 24 * 60 * 60 * 1000;
                await redis.zremrangebyscore(`hourly_price_data:${pair}`, 0, thirtyDaysAgo);
    
            } catch (error) {
                console.error(`Error store hourly data for ${pair}:`, error);
            }
        }
    }

async function cleanupData() {
    const now = Date.now();
    const dayAgo = now - 86400000; 
    const monthAgo = now - 2592000000;

    for (const pair of Object.keys(latestTickerData)) {
        await redis.zremrangebyscore(`recent_price_data:${pair}`, 0, dayAgo); // remove data older than 24 hours
        await redis.zremrangebyscore(`hourly_price_data:${pair}`, 0, monthAgo); // remove data older than 30 days
    }
}


export async function queryMonthlyTrend(pair) {
    const now = Date.now();
    const monthAgo = now - 2592000000;
    return await redis.zrangebyscore(`hourly_price_data:${pair}`, monthAgo, now, "WITHSCORES");
}

async function get24hHighLow(pair) {
    const newPair = pair.toUpperCase().replace("_", "");
    const now = Date.now();
    const dayAgo = now - 86400000;
    try {
        const prices = await redis.zrangebyscore(`recent_price_data:${newPair}`, dayAgo, now);
        const priceValues = prices.map(p => parseFloat(JSON.parse(p).price));
        return {
            high: Math.max(...priceValues),
            low: Math.min(...priceValues)
        };
    } catch (error) {
        console.error("Error fetching 24h high low:", error);
        return null;
    }
}


///////////////////////// Binance websocket events  /////////////////////////
binanceWS.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data: streamData } = parsedData;

    const pair = stream.split("@")[0].toUpperCase();

    latestTickerData[pair] = {
        symbol: streamData.s,
        price: streamData.c,
        // priceChangePercent: streamData.P,
    };
    updatePriceData(pair, streamData.c)
});

binanceWS.on("error", (error) => {
    console.error("Websocket error:", error);
});


/////////////////////////  SCHEDULE JOBS  ///////////////////////// 
schedule.scheduleJob("0 * * * *", storeHourlyData); // store hourly data every hour
schedule.scheduleJob("0 0 * * *", cleanupData); // clean up data every day


///////////////////////// API ROUTES /////////////////////////
router.get("/ticker", (req, res) => {
    res.status(200).json({ ok: true, latestTickerData: latestTickerData });
});

router.get("/ticker/:pair", async (req, res) => {
    const { pair } = req.params;
    // console.log("Latest price:", pair);
    const formattedPair = pair.toUpperCase().replace("_", "");
    const latestPrice = latestTickerData[formattedPair];
    res.status(200).json({ ok: true, data: latestPrice });
});

// order book
let latestOrderBookSnapshot = {};

export async function logOrderBookSnapshot(symbol, processedData) {
    latestOrderBookSnapshot[symbol] = processedData;
    return latestOrderBookSnapshot[symbol];
}

router.get("/orderBook/:pair", async (req, res) => {
    const { pair } = req.params;
    // console.log("Latest order book snapshot:", pair);
    const symbol = pair.split("_")[0]; // xxx_usdt -> xxx
    const orderBookSnapshot = latestOrderBookSnapshot[symbol];
    
    if (!orderBookSnapshot) {
        return res.status(401).json({ ok: false, error: "No Data" });
    }
    
    res.status(200).json({ ok: true, data: orderBookSnapshot });
});


router.get("/24hHighAndLow/:pair", async (req, res) => {
    const { pair } = req.params;
    // console.log("24h high low:", pair);
    const highLow = await get24hHighLow(pair);
    res.status(200).json({ ok: true, data: highLow });
});


router.get("/monthlyTrend/:pair", async (req, res) => {
    const { pair } = req.params;
    // console.log("Monthly trend:", pair);
    try {
        const monthlyTrend = await queryMonthlyTrend(pair);
        res.status(200).json({ ok: true, monthlyTrend });
    } catch (error) {
        console.error("Error fetching monthly trend:", error);
    }
});

///////////////////////// Error handling /////////////////////////
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export default router;