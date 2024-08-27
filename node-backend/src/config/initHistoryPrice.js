import axios from "axios";
import Redis from "ioredis";
import config from "./config.js";


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
    console.log("Successfully connected to Redis");
  });
  
  redis.on("error", (error) => {
    console.error("Redis connection error:", error);
  });

// support symbol
const supportedSymbols = config.supportedSymbols;
const symbols = supportedSymbols.map(symbol => `${symbol.toUpperCase()}USDT`);

async function getHourlyOpenPrices(symbol, interval = "1h", days = 30) {
    const baseUrl = "https://api.binance.com/api/v3/klines";
    
    const endTime = Date.now();
    let startTime = endTime - days * 24 * 60 * 60 * 1000;
    
    const allOpenPrices = [];
    
    while (startTime < endTime) {
        const params = {
            symbol: symbol,
            interval: interval,
            startTime: startTime,
            endTime: endTime,
            limit: 1000
        };
        
        try {
            const response = await axios.get(baseUrl, { params });
            const klines = response.data;
            
            if (klines.length === 0) break;
            
            const openPrices = klines.map(k => ({
                timestamp: new Date(k[0]).toISOString(),
                open: parseFloat(k[1])
            }));
            
            allOpenPrices.push(...openPrices);
            
            startTime = klines[klines.length - 1][6] + 1;
        } catch (error) {
            console.error("Error fetching data:", error.message);
            break;
        }
    }
    
    return allOpenPrices;
}

async function storeDataInRedis(symbol, data) {
    const key = `hourly_price_data:${symbol}`;
    const pipeline = redis.pipeline();

    pipeline.del(key); // delete the old data

    for (const item of data) { // store the new data
        const score = new Date(item.timestamp).getTime();
        pipeline.zadd(key, score, JSON.stringify(item));
    }

    await pipeline.exec();
    console.log(`Updated ${data.length} records in Redis`);
}

async function processSymbol(symbol) {
    const interval = "1h";
    const days = 30;
    
    try {
        console.log(`Processing ${symbol}...`);
        const data = await getHourlyOpenPrices(symbol, interval, days);
        await storeDataInRedis(symbol, data);
        
        // Retrieve the last 5 records from Redis
        const redisData = await redis.zrevrange(`hourly_price_data:${symbol}`, 0, 4, "WITHSCORES");
        console.log(`Last 5 records from Redis for ${symbol}:`);
        for (let i = 0; i < redisData.length; i += 2) {
            const item = JSON.parse(redisData[i]);
            const score = redisData[i+1];
            console.log(`Time: ${item.timestamp}, Open Price: ${item.open}, Score: ${score}`);
        }
    } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
    }
}

async function main() {
    try {
        for (const symbol of symbols) {
            await processSymbol(symbol);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before processing the next symbol
        }
    } catch (error) {
        console.error("Error in main function:", error);
    } finally {
        // Close Redis connection
        await redis.quit();
    }
}

main().catch(console.error);