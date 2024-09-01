import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import WebSocket from "ws";
import Decimal from "decimal.js";

dotenv.config();
console.log("Environment variables loaded");

const wsBaseUrl = process.env.WSS_BINANCE_URL;
const supportedSymbols = process.env.SUPPORTED_SYMBOLS.split(",").map(symbol => symbol.trim());
const tradingPairs = supportedSymbols.map(symbol => `${symbol}usdt`);
const streamName = tradingPairs.map(pair => `${pair}@ticker`).join("/");
const wsUrl = `${wsBaseUrl}?streams=${streamName}`;

const binanceWS = new WebSocket(wsUrl);

let latestTickerData = {};


binanceWS.on("message", (data) => {
    const parsedData = JSON.parse(data);
    const { stream, data: streamData } = parsedData;
    const pair = stream.split("@")[0].toUpperCase();

    const updateData = {
        symbol: pair,
        price: streamData.c
    };
    latestTickerData[pair] = updateData;
});

binanceWS.on("error", (error) => {
    console.error("WebSocket error: ", error);
});

class MarketMaker {
    constructor(){
        this.url = "https://localhost:9091";
        this.cookies = {};
        this.orders = {};
        this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
        });
        console.log("MarketMaker instance created");
    }

    async login(email, password){
        try {
            const response = await this.axiosInstance.post(`${this.url}/api/user/auth`, { email, password }, {
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.headers["set-cookie"]) {
                response.headers["set-cookie"].forEach(cookie => {
                    const [key, value] = cookie.split(";")[0].split("=");   
                    this.cookies[key] = value;
                });
            }

            console.log("Login successful");
            return response.data;
        } catch (error) {
            console.error("Login failed:", error.message);
            throw error;
        }
    }

    async getOrders(){
        try{
            const response = await this.axiosInstance.get(`${this.url}/api/trade/order`,{
                headers: {
                    Cookie: `accessToken=${this.cookies.accessToken}`
                }
            });
            return response.data.orders || [];
        } catch (error) {
            console.error("Error in [getOrders]: ", error);
            return [];
        }
    }

    async createOrder(symbol, side, type, price, quantity){
        try {
            console.log(`Creating order: ${symbol} ${side} ${type} ${price} ${quantity}`);
            const response = await this.axiosInstance.post(`${this.url}/api/trade/order`, 
                { symbol, side, type, price, quantity }, {
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": `accessToken=${this.cookies.accessToken}`
                    }
                });
            return response.data;
        } catch (error) {
            console.error("Error in [createOrder]: ", error);
        }
    }

    async cancelOrder(orderId, symbol) {
        try {
            console.log(`Cancelling order: ${orderId} for ${symbol}`);
            const response = await this.axiosInstance.patch(`${this.url}/api/trade/order`, {
                    orderId, symbol
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": `accessToken=${this.cookies.accessToken}`
                    }
                });
            return response.data;
        } catch (error) {
            console.error("Error in [cancelOrder]: ", error);
        }
    }

    determinePrecision(currentPrice) {
        const priceNum = parseFloat(currentPrice);
        const integerDigits = Math.floor(Math.log10(priceNum)) + 1;
        const precision = Math.max(integerDigits, 0);
        return precision;
    }

    async adjustMarketMakerOrders() {
        try {
            console.log("開始調整做市商訂單");
            for (const symbol of supportedSymbols) {
                const pair = `${symbol.toUpperCase()}USDT`;
                const formattedSymbol = `${symbol}_usdt`;
                const currentPrice = latestTickerData[pair]?.price;
                if (!currentPrice) {
                    console.log(`無法獲取 ${pair} 的價格數據，跳過`);
                    continue;
                }
    
                // 添加打印語句
                console.log(`處理 ${pair}，當前價格: ${currentPrice}`);
    
                const precision = this.determinePrecision(currentPrice);
    
                const baseSpread = Math.pow(10, -precision-1)
                const buySpread = baseSpread + (Math.random() * Math.pow(15, -precision));
                const sellSpread = baseSpread + (Math.random() * Math.pow(15, -precision));
    
                const buyPrice = new Decimal(currentPrice).times(1 - buySpread).toFixed(2);
                const sellPrice = new Decimal(currentPrice).times(1 + sellSpread).toFixed(2);
                console.log(`買入價: ${buyPrice}, 賣出價: ${sellPrice}`);
    
                const min = 1/Math.pow(10, precision);
                const max = 20/Math.pow(10, precision);
                const buyQuantity = (Math.random() * (max - min) + min).toFixed(precision);
                const sellQuantity = (Math.random() * (max - min) + min).toFixed(precision);
    
                // 添加打印語句
                console.log(`買入量: ${buyQuantity}, 賣出量: ${sellQuantity}`);
    
                await this.placeOrUpdateOrder(formattedSymbol, "buy", buyPrice, buyQuantity);
                await this.placeOrUpdateOrder(formattedSymbol, "sell", sellPrice, sellQuantity);
            }
        } catch (error) {
            console.error("調整做市商訂單時出錯: ", error);
        }
    }
    
    determinePrecision(currentPrice) {
        const priceNum = parseFloat(currentPrice);
        const integerDigits = Math.floor(Math.log10(priceNum)) + 1;
        const precision = Math.max(integerDigits, 0);
        // 添加打印語句
        console.log(`當前價格: ${currentPrice}, 精度: ${precision}`);
        return precision;
    }
    
    async placeOrUpdateOrder(symbol, side, price, quantity) {
        const pair = `${symbol.toUpperCase()}`.replace("_", "");
        const existingOrder = this.orders[`${symbol}_${side}`];
        const currentPrice = latestTickerData[pair]?.price;
        
        // 添加打印語句
        console.log(`處理 ${symbol} ${side} 訂單，當前價格: ${currentPrice}`);
    
        if (existingOrder) {
            const { orderStatus, orderSide, orderPrice } = await this.getOrderDetails(existingOrder.orderId);
    
            // 添加打印語句
            console.log(`現有訂單狀態: ${orderStatus}, 方向: ${orderSide}, 價格: ${orderPrice}`);
    
            const dCurrentPrice = new Decimal(currentPrice);
            const dOrderPrice = new Decimal(existingOrder.price);
            const priceDifference = dOrderPrice.minus(dCurrentPrice);
            const priceDifferenceAbs = priceDifference.abs();
            const maxDifference = priceDifferenceAbs.times(0.001);
    
            // 修改：統一使用 Decimal 進行比較，避免精度問題
    
            if (orderStatus === "open" 
                && orderSide === "buy" 
                && dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference) 
                && priceDifference.greaterThan(0)) {
                console.log(`取消買入訂單: ${existingOrder.orderId}`);
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[`${symbol}_${side}`];
            } else if (
                orderStatus === "open" 
                && orderSide === "sell"
                && dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference)
                && priceDifference.lessThan(0)) 
            {
                console.log(`取消賣出訂單: ${existingOrder.orderId}`);
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[`${symbol}_${side}`];
            } else if (
                orderStatus === "filled" 
                || orderStatus === "partially_filled" 
                || orderStatus === "CANCEL" 
                || orderStatus === "PARTIALLY_FILLED_CANCELED" ) { 
                console.log(`訂單 ${existingOrder.orderId} 已完成或取消，移除記錄`);
                delete this.orders[`${symbol}_${side}`];
            } else {
                console.log(`${symbol} ${side} 訂單無需更新`);
                return;
            }
        }
    
        console.log(`創建新的 ${side} 訂單: ${symbol}, 價格: ${price}, 數量: ${quantity}`);
        const newOrder = await this.createOrder(symbol, side, "limit", price, quantity);
        if (newOrder && newOrder.order) {
            this.orders[`${symbol}_${side}`] = newOrder.order;
            console.log(`新訂單創建成功: ${newOrder.order.orderId}`);
        } else {
            console.error(`創建 ${symbol} ${side} 訂單失敗`);
        }
    }

    async getOrderDetails(orderId) {
        try {
            const orders = await this.getOrders();
            const order = orders.find(order => order.orderId === orderId);
            if (order) {
                return {
                    orderStatus: order.status,
                    orderSide: order.side,
                    orderPrice: order.price
                };
            } else {
                return { status: "NOT_FOUND", side: null, price: null };
            }
        } catch (error) {
            console.error("Error in [getOrderStatus]: ", error);
            return { status: "ERROR", side: null, price: null };
        }
    }

///////////////////////// INITIALIZE MARKET MAKER /////////////////////////
    async initializeMarketMaker(){
        try {
            const existingOrders = await this.getOrders();
            for (const order of existingOrders) {
                if (order.status === "open" || order.status === "partially_filled") {
                    const key = `${order.symbol}_${order.side}`;
                    this.orders[key] = order;
                    console.log(`加載現有訂單: ${key}, 訂單ID: ${order.orderId}`);
                }
            }
        } catch (error) {
            console.error("初始化做市商時出錯: ", error);
        }
    }

    async startMarketMaker(){
        console.log("Starting market maker");
        await this.initializeMarketMaker();
        setInterval(() => {
            this.adjustMarketMakerOrders();
        }, 3000);
    }
}

async function main(){
    console.log("Starting main function");
    const marketMaker = new MarketMaker();
    try {
        await marketMaker.login(`${process.env.MARKET_MAKER_EMAIL}`, `${process.env.MARKET_MAKER_PASSWORD}`);
        if (marketMaker.cookies.accessToken) {
            console.log("Market Maker logged in successfully");
            marketMaker.startMarketMaker();
            await new Promise(() => {});
        }
    } catch (error) {
        console.error("Error in main: ", error);
    }
}

main();