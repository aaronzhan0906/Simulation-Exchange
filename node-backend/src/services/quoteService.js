import express from "express";
import WebSocket from "ws";
import Redis from "ioredis";
import config from "../config/config.js";
import WebSocketService from "./websocketService.js";
import schedule from "node-schedule";
import { logger } from "../app.js"

const router = express.Router();
// Create Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || "172.31.23.16",
    port: process.env.REDIS_PORT || 6379,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
});
  
  // Add connection listeners
redis.on("connect", () => {
    logger.info("Successfully connected to Redis");
});
  
redis.on("error", (error) => {
    logger.error(`[Redis connection] error: ${error}`);
});

const wsBaseUrl = process.env.WSS_BINANCE_URL;
const supportedSymbols = config.supportedSymbols;
const tradingPairs = supportedSymbols.map(symbol => `${symbol}usdt`);
const streamName = tradingPairs.map(pair => `${pair}@ticker`).join("/");
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;

let latestTickerData = {}; // for different trading pairs { BNBUSDT: {symbol: 'BNBUSDT' price: '551.10000000',priceChangePercent: '-1.73' }
// store price at least once every 1s
let lastBroadcastTime = {};

///////////////////////// Binance websocket events  /////////////////////////
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15; 
const RECONNECT_DELAY = 2000;

function connectionWebSocket(){
    const binanceWS = new WebSocket(wsUrl);

    binanceWS.on("open", () => {
        logger.info("[binanceWS.open] WebSocket connection opened.")
        
        if (reconnectAttempts > 0){
            logger.info(`[Connection Recovered] after ${reconnectAttempts} attempts`)
        }
        reconnectAttempts = 0;
    })

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
        logger.error(`[binanceWS.error] ${error}`);
        attemptReconnect();
    });

    binanceWS.on("close", () => {
        logger.info(`[binanceWS.close] Connection closed`);
        attemptReconnect();
    })
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error("Max reconnect attempts reached. Stop reconnecting");
        return; 
    }
    reconnectAttempts++;

    logger.warn(`Attempting to reconnect [Binance WS] (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    logger.info(`Attempting to reconnect in ${RECONNECT_DELAY / 1000} seconds...`);

    setTimeout(() => {
        logger.info("[Binance WS] Reconnecting...");
        connectionWebSocket();
    }, RECONNECT_DELAY);
}

connectionWebSocket();

/////////////////////////  WebSocket functions ///////////////////////// 
function broadcastMessageToAll(type, data) {
    WebSocketService.broadcastToAllSubscribers({ type, data });
}

function broadcastToRoom(symbol, data) {
    const roomSymbol = symbol.slice(0, -4).toLowerCase() + "_usdt";
    WebSocketService.broadcastToRoom(roomSymbol, { type: "ticker", ...data }); 
}

function broadcastToRoomEvery3s(symbol, data) {
    const roomSymbol = symbol.slice(0, -4).toLowerCase() + "_usdt_3s";
    const now = Date.now();
    if (!lastBroadcastTime[symbol] || now - lastBroadcastTime[symbol] >= 3000) {
        WebSocketService.broadcastToRoom(roomSymbol, { type: "ticker_3s", ...data });
        lastBroadcastTime[symbol] = now;
    }
}

export async function updatePriceData(pair, price) {
    try{
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
        broadcastToRoomEvery3s(formattedPair, updatedData);

    
        await storePriceData(formattedPair, updatedData);
    } catch (error) {
        logger.error(`[updatePriceData]: ${error}`);
    }
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

        const oneDayAgo = now - 86400000;
        await redis.zremrangebyscore(`recent_price_data:${pair}`, 0, oneDayAgo);
    } catch (error) {
        logger.error(`[storePriceData]: ${error}`);
    }
}

export async function getLatestPriceData(pair) {
    try {
        const latestPrice = await redis.get(`latest_price:${pair}`);
        return latestPrice ? JSON.parse(latestPrice) : null;
    } catch (error) {
        logger.error(`[getLatestPriceData]: ${error}`);
        return null;
    }
}

async function calculate24hChangePercent(pair, currentPrice) {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0); // XX:00:00
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000 + 1000); // 24 hours ago plus 1 second to ensure retrieving the data point from exactly 24 hours ago
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000 - 1000);

    try {
        const oldPriceData = await redis.zrevrangebyscore(
            `hourly_price_data:${pair}`, 
            twentyFourHoursAgo.getTime(),
            twentyFiveHoursAgo.getTime(),
            "LIMIT", 0, 1
        );
    
    
        const oldPriceObj = JSON.parse(oldPriceData[0]);
        const oldPrice = parseFloat(oldPriceObj.open);
        const changePercent = ((currentPrice - oldPrice) / oldPrice) * 100;

        return changePercent.toFixed(2);

    } catch (error) {
        logger.error(`Error [calculate24hChangePercent] ${pair}:`, error);
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
            logger.error(`[storeHourlyData]${pair}: ${error}`);
        }
    }
}

async function cleanupData() {
    const now = Date.now();
    const dayAgo = now - 86400000; 
    const monthAgo = now - 2592000000;

    for (const pair of Object.keys(latestTickerData)) {
        try {
            await redis.zremrangebyscore(`recent_price_data:${pair}`, 0, dayAgo);
            await redis.zremrangebyscore(`hourly_price_data:${pair}`, 0, monthAgo);
        } catch (error) {
            logger.error(`[cleanupData]${pair}: ${error}`);
        }
    }
}


export async function queryMonthlyTrend(pair) {
    try {
        const now = Date.now();
        const monthAgo = now - 2592000000;
        return await redis.zrangebyscore(`hourly_price_data:${pair}`, monthAgo, now, "WITHSCORES");
    } catch (error) {
        logger.error(`[queryMonthlyTrend]${pair}: ${error}`);
        return [];
    }
}

async function get24hHighLow(pair) {
    const newPair = pair.toUpperCase().replace("_", "");
    const now = Date.now();
    const dayAgo = now - 86400000;
    try {
        const prices = await redis.zrangebyscore(`recent_price_data:${newPair}`, dayAgo, now);

        let high = -Infinity;
        let low = Infinity;

        for (const priceStr of prices) {
            const price = parseFloat(JSON.parse(priceStr).price);
            if (price > high) { high = price; }
            if (price < low) { low = price; }
        }

        return { high, low };
    } catch (error) {
        logger.error("Error fetching 24h high low:", error);
        const currentPriceData = latestTickerData[newPair];
        if (!currentPriceData) {
            logger.error(`No current price data for ${newPair}`);
            return null;
        }
        
        const currentPrice = parseFloat(currentPriceData.price);
        
        const high = currentPrice * 1.05;
        const low = currentPrice * 0.95;
        
        logger.info(`Using fallback high-low for ${newPair}: ${high}-${low}`);
        return { high, low };
    }
}





/////////////////////////  SCHEDULE JOBS  ///////////////////////// 
schedule.scheduleJob("0 * * * *", storeHourlyData); // store hourly data every hour
schedule.scheduleJob("0 0 * * *", cleanupData); // clean up data every day


///////////////////////// API ROUTES /////////////////////////
router.get("/ticker", (req, res) => {
    res.status(200).json({ ok: true, latestTickerData: latestTickerData });
});

router.get("/ticker/:pair", async (req, res) => {
    try {
        const { pair } = req.params;
        const formattedPair = pair.toUpperCase().replace("_", "");
        const latestPrice = latestTickerData[formattedPair];
        res.status(200).json({ ok: true, data: latestPrice });
    } catch (error) {
        logger.error(`[/ticker/:pair]: ${error}`);
    }
});

// order book
let latestOrderBookSnapshot = {};

export async function logOrderBookSnapshot(symbol, processedData) {
    try {
        latestOrderBookSnapshot[symbol] = processedData;
        return latestOrderBookSnapshot[symbol];
    } catch (error) {
        logger.error(`[logOrderBookSnapshot]: ${error}`);
        return null;
    }
}

router.get("/orderBook/:pair", async (req, res) => {
    const { pair } = req.params;
    try {
        logger.info(`Latest order book snapshot: ${pair}`);
        const symbol = pair.split("_")[0]; // xxx_usdt -> xxx
        const orderBookSnapshot = latestOrderBookSnapshot[symbol];
        if (!orderBookSnapshot) {
            return res.status(400).json({ error: false, error: "No Data" });
        }
        
        res.status(200).json({ ok: true, data: orderBookSnapshot });
    } catch (error) {
        logger.error(`[/orderBook/:pair] error${error}`);
    }
});


router.get("/24hHighAndLow/:pair", async (req, res) => {
    const { pair } = req.params;
    // logger.info("24h high low:", pair);
    try{
        const highLow = await get24hHighLow(pair);
        res.status(200).json({ ok: true, data: highLow });
    } catch (error) {
        logger.error(`[/24hHighAndLow/:pair] error ${error}`);
    }
});


router.get("/monthlyTrend/:pair", async (req, res) => {
    const { pair } = req.params;
    // logger.info("Monthly trend:", pair);
    try {
        const monthlyTrend = await queryMonthlyTrend(pair);
        res.status(200).json({ ok: true, monthlyTrend });
    } catch (error) {
        logger.error(`[/monthlyTrend/:pair] error ${error}`);
    }
});

///////////////////////// Error handling /////////////////////////
process.on("uncaughtException", (error) => {
    logger.error(`Uncaught Exception: ${error}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, "reason: ${reason}`);
});

export default router;