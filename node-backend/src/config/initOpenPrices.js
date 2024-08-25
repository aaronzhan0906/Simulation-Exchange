import axios from "axios";
import Redis from "ioredis";

// Create Redis client
const redis = new Redis();

// Add connection listeners
redis.on("connect", () => {
    console.log("Successfully connected to Redis");
});

redis.on("error", (error) => {
    console.error("Redis connection error:", error);
});

async function getHourlyOpenPrices(symbol = "BTCUSDT", interval = "1h", days = 30) {
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

    // First, delete the old data
    pipeline.del(key);

    // Then add the new data
    for (const item of data) {
        const score = new Date(item.timestamp).getTime();
        pipeline.zadd(key, score, JSON.stringify(item));
    }

    await pipeline.exec();
    console.log(`Updated ${data.length} records in Redis`);
}

async function main() {
    const symbol = "BTCUSDT";
    const interval = "1h";
    const days = 30;
    
    try {
        // Fetch data
        const data = await getHourlyOpenPrices(symbol, interval, days);

        // Store in Redis
        await storeDataInRedis(symbol, data);

        // Retrieve the last 10 records from Redis
        const redisData = await redis.zrevrange(`price:${symbol}`, 0, 4, "WITHSCORES");
        console.log("Last 5 records from Redis:");
        for (let i = 0; i < redisData.length; i += 2) {
            const item = JSON.parse(redisData[i]);
            const score = redisData[i+1];
            console.log(`Time: ${item.timestamp}, Open Price: ${item.open}, Score: ${score}`);
        }

    } catch (error) {
        console.error("Error in main function:", error);
    } finally {
        // Close Redis connection
        await redis.quit();
    }
}

main().catch(console.error);