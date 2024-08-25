import express from "express";
import WebSocket from "ws";
import Redis from "ioredis";
import config from "../config/config.js";
import WebSocketService from "./websocketService.js";
import schedule from "node-schedule";
// import pool from "../config/database.js";

const router = express.Router();
const redis = new Redis({
    host: config.redis.host || "localhost",
    port: config.redis.port || 6379,
});

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
const binanceWs = new WebSocket(wsUrl);
let latestTickerData = {}; // for different trading pairs { pair, streamData.c, streamData.P }


// WebSocket functions //////////////////////////////////////////
function broadcastMessage(type, data) {
    WebSocketService.broadcastToAllSubscribers({ type, data });
}

function broadcastToRoom(symbol, data) {
    const roomSymbol = symbol.slice(0, -4).toLowerCase() + "_usdt";
    WebSocketService.broadcastToRoom(roomSymbol, { type: "ticker", ...data });
}

export function updatePriceData(pair, price, priceChangePercent) {
    const now = new Date();
    const timestamp = now.toISOString();

    latestTickerData[pair] = {
        timestamp: timestamp,
        price: price,
        priceChangePercent: priceChangePercent
    };

    WebSocketService.broadcastToRoom(`${pair.toLowerCase()}_usdt`, {
        type: "priceUpdate",
        data: latestTickerData[pair]
    });

    redis.set(`latest_price:${pair}`, JSON.stringify(latestTickerData[pair]));
}


// Redis functions //////////////////////////////////////////
async function storePrice() {
    try {
        const now = new Date();
        const timestamp = now.toISOString();
        const unixTimestamp = now.getTime(); 

        for (const [pair, data] of Object.entries(latestTickerData)) {
            const storedData = {
                ...data,
                timestamp: timestamp
            };

            await redis.zadd(
                `recent_price_data:${pair}`,
                unixTimestamp,  
                JSON.stringify(storedData)
            );
        }
    } catch (error) {
        console.error("Error storing price:", error);
    }
}

export async function getLatestPriceData(pair) {
    const latestPrice = await redis.get(`latest_price:${pair}`);
    return latestPrice ? JSON.parse(latestPrice) : null;
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

export async function queryDailyTrend(pair) {
    const now = Date.now();
    const dayAgo = now - 86400000;
    return await redis.zrangebyscore(`recent_price_data:${pair}`, dayAgo, now, "WITHSCORES");
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


// Binance websocket events  //////////////////////////////////////////
binanceWs.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data: streamData } = parsedData;

    const pair = stream.split("@")[0].toUpperCase();

    latestTickerData[pair] = {
        symbol: streamData.s,
        price: streamData.c,
        priceChangePercent: streamData.P,
    };

    broadcastMessage(`ticker${pair.replace("USDT", "")}`, latestTickerData[pair]);
    broadcastToRoom(pair, latestTickerData[pair]);
    updatePriceData(pair, streamData.c, streamData.P);
});

binanceWs.on("error", (error) => {
    console.error("Websocket error:", error);
});


// schedule jobs  //////////////////////////////////////////
setInterval(storePrice, 1000); // store price every second
schedule.scheduleJob("0 * * * *", storeHourlyData); // store hourly data every hour
schedule.scheduleJob("0 0 * * *", cleanupData); // clean up data every day


// API routes //////////////////////////////////////////////
router.get("/ticker", (req, res) => {
    res.status(200).json({ ok: true, latestTickerData: latestTickerData });
});

router.get("/latest-price/:pair", async (req, res) => {
    const { pair } = req.params;
    const latestPrice = await getLatestPriceData(pair);
    res.status(200).json({ ok: true, latestPrice });
});

router.get("/24h-high-low/:pair", async (req, res) => {
    const { pair } = req.params;
    console.log("24h high low:", pair);
    const highLow = await get24hHighLow(pair);
    if (highLow) {
        res.status(200).json({ ok: true, data: highLow });
    } else {
        res.status(404).json({ ok: false, error: "Data not found" });
    }
});

router.get("/daily-trend/:pair", async (req, res) => {
    const { pair } = req.params;
    const dailyTrend = await queryDailyTrend(pair);
    res.status(200).json({ ok: true, dailyTrend });
});

router.get("/monthly-trend/:pair", async (req, res) => {
    const { pair } = req.params;
    console.log("Monthly trend:", pair);
    try {
        const monthlyTrend = await queryMonthlyTrend(pair);
        res.status(200).json({ ok: true, monthlyTrend });
    } catch (error) {
        console.error("Error fetching monthly trend:", error);
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
});

// Error handling //////////////////////////////////////////
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export default router;