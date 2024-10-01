import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import WebSocket from "ws";
import Decimal from "decimal.js";
import { EventEmitter } from "events";



dotenv.config();
console.log("Environment variables loaded");
const MAX_ORDER = 6;

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
        this.url = process.env.TARGET_URL;
        this.wsUrl = process.env.TARGET_URL.replace("https", "wss");
        this.cookies = {};
        this.orders = {};
        this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
        });
        this.eventEmitter = new EventEmitter();
        this.isInitializing = false;
        this.lastInitializeTime = 0;
        this.initializeInterval = 2100;

        // ordersCache
        this.ordersCache = null;
        this.ordersCacheTime = 0;
        this.ordersCacheTTL = 500;
        console.log("MarketMaker instance created");

        // cancel order 
        this.cancellingOrders = new Set();
        setInterval(() => this.cleanCancellingOrders(), 60000)
    }

///////////////////////// WS FUNCTIONS /////////////////////////
    connect() {
        return new Promise((resolve, reject) => {
            const headers = {
                Cookie: `accessToken=${this.cookies.accessToken}`
            };
    
            this.ws = new WebSocket(this.wsUrl, {
                headers: headers,
                rejectUnauthorized: false
            });
        
            this.ws.on("open", () => {
                console.log("WebSocket connected to trading server");
                resolve();
            });
        
            this.ws.on("message", (data) => {
                this.handleMessage(data);
            });
        
            this.ws.on("error", (error) => {
                console.error("Trading server WebSocket error: ", error);
                reject(error);
            });
        
            this.ws.on("close", () => {
                console.log("WebSocket connection closed");
            })
        });
    }

    requestPersonalData(){
        console.log("requesting personal data");
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ action: "getPersonalData"}));
        } else {
            console.error("WebSocket is not open. Unable to request personal data.");
        }
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event);
            switch(message.type) {
                case "welcome":
                    console.log("Received welcome message");
                    break;

                case "orders":
                    this.handleOrdersData(message.data);
                    break;

                case "orderCreated":
                    this.handleOrderCreated(message.data);
                    break;
                
                case "orderUpdate":
                    break;

                case "error":
                    console.error("WS error:", message.message);
                    break;
                default:
                    console.log("Unhandled message type:", message.type);
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    }
    

    sendMessage(message){ 
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error(`[sendMessage] error ${message}`);
        }
    }


///////////////////////// MARKET MAKER FUNCTIONS /////////////////////////
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

    async getOrders() {
        const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const maxRetries = 5;
        const retryDelay = 10000;

        const attemptGetOrders = () => {
            return new Promise((resolve, reject) => {
                const now = Date.now();
                if (this.ordersCache && now - this.ordersCacheTime < this.ordersCacheTTL) {
                    // console.log("使用快取訂單數據");
                    resolve(this.ordersCache);
                    return;
                }
    
                try {
                    const message = {
                        action: "getOrdersByMarketMaker",
                    };
                    this.sendMessage(message);
    
                    const timeoutId = setTimeout(() => {
                        this.eventEmitter.removeAllListeners("ordersReceived");
                        reject(new Error("獲取訂單超時"));
                    }, 15000);
    
                    this.eventEmitter.once("ordersReceived", (orders) => {
                        clearTimeout(timeoutId);
                        this.ordersCache = orders;
                        this.ordersCacheTime = Date.now();
                        resolve(orders);
                    });
                } catch (error) {
                    console.error("[getOrders] error:", error);
                    reject(error);
                }
            });
        };
    
        for (let attempt = 1; attempt <= maxRetries; attempt++){
            try {
                return await attemptGetOrders();
            } catch (error) {
                console.error(`獲取訂單失敗，嘗試 ${attempt}/${maxRetries}:`, error);
                if (attempt < maxRetries) {
                    console.log(`系統將暫停${retryDelay / 1000}秒後重試...`);
                    await pause(retryDelay);
                } else {
                    console.error("重試都失敗，準備重啟系統");
                    throw new Error("重啟系統");
                }
            }
        }
    }

    handleOrdersData(ordersData) {
        this.eventEmitter.emit("ordersReceived", ordersData.orders);
    }

    clearOrdersCache() {
        this.ordersCache = null;
        this.ordersCacheTime = 0;
    }

    async createOrder(symbol, side, type, price, quantity) {
        const message = {
            action: "createOrderByMarketMaker",
            data: { 
                symbol, 
                side, 
                type, 
                price, 
                quantity
            }
        };
        this.sendMessage(message);
        console.log(`＋＋＋＋＋創建新訂單: ${symbol}, ${side}, ${price}, ${quantity}`);
    }

    handleOrderCreated(orderData) {
        const newOrder = orderData.order;
        if (newOrder) {
            const { symbol, side, orderId } = newOrder;
            const baseOrderKey = `${symbol}_${side}`;
    
            if (!this.orders[baseOrderKey]) {
                this.orders[baseOrderKey] = {};
            }
    
            if (Object.keys(this.orders[baseOrderKey]).length < MAX_ORDER) {
                this.orders[baseOrderKey][orderId] = newOrder;
            } else {
                console.log(`${baseOrderKey} 已達到最大訂單數 ${MAX_ORDER}，不添加新訂單`);
                this.cancelOrder(orderId, symbol);
            }
        } else {
            console.error(`Failed to create order: ${JSON.stringify(orderData)}`);
        }
    }

    async cancelOrder(orderId, symbol) {
        if (this.cancellingOrders.has(orderId)){
            console.log(`訂單 ${orderId} 已經在取消過程中`);
            return;
        }

        try {
            const message = {
                action: "cancelOrderByMarketMaker",
                data: {
                    orderId,
                    symbol
                }
            };
            this.sendMessage(message)
            this.cancellingOrders.add(orderId, Date.now());
            console.log(`～～～～～Cancelling order: ${orderId} for ${symbol}`);

            setTimeout(() => {
                this.cancellingOrders.delete(orderId);
            }, 60000); 
        } catch(error) {
            console.error(`[cancelOrder] 錯誤: ${error}`);
            this.cancellingOrders.delete(orderId);
            return;
        }
    } 

    cleanCancellingOrders() {
        const now = Date.now();
        for (const [orderId, timestamp] of this.cancellingOrders){
            if (now -timestamp > 30000) {
                this.cancellingOrders.delete(orderId);
            }
        }
    }


    async cancelAllOrders() {
        try {
            console.log("Starting to cancel all orders");
            
            const allOrders = await this.getOrders();
            const cancelPromises = [];
            console.log("cancelPromises:",cancelPromises);
            for (const order of allOrders) {
                if (order.status === "open" || order.status === "partially_filled") {
                    cancelPromises.push(this.cancelOrder(order.orderId, order.symbol));
                }
            }

            await Promise.all(cancelPromises);

            this.orders = {};

            console.log("Cancelled all orders");
        } catch (error) {
            console.error("[cancelAllOrders] error", error);
        }
    }


    determinePrecision(currentPrice) {
        const priceNum = parseFloat(currentPrice);
        const integerDigits = Math.floor(Math.log10(priceNum)) + 1;
        const precision = Math.max(integerDigits, 0);
        return precision;
    }

    async adjustMarketMakerOrders() {
        if (this.isInitializing) {
            console.log("系統正在初始化中，跳過計算單");
            return;
        }

        try {
            console.log("------------------------------------");
            console.log("start adjusting market maker orders");
            console.log("------------------------------------");

            for (const symbol of supportedSymbols) {
                const pair = `${symbol.toUpperCase()}USDT`;
                const formattedSymbol = `${symbol}_usdt`;
                const currentPrice = latestTickerData[pair]?.price;
                if (!currentPrice) {
                    continue;
                }                
    
                const precision = this.determinePrecision(currentPrice);
                
                for (let i = 0; i < MAX_ORDER; i++) {
                    const baseSpread = Math.pow(10, -precision-1) * Math.pow(i , 4)/7 ;
                    const buySpread = (baseSpread + (Math.random() * Math.pow(10, -precision)))/5;
                    const sellSpread = (baseSpread + (Math.random() * Math.pow(10, -precision)))/5;
        
                    const buyPrice = new Decimal(currentPrice).times(1 - buySpread).toFixed(2);
                    const sellPrice = new Decimal(currentPrice).times(1 + sellSpread).toFixed(2);
        
                    const min = 5/Math.pow(10, precision);
                    const max = 6000/Math.pow(10, precision);
                    const buyQuantity = (Math.random() * (max - min) + min).toFixed(precision);
                    const sellQuantity = (Math.random() * (max - min) + min).toFixed(precision);
                    
                    await this.placeOrUpdateOrder(formattedSymbol, "buy", buyPrice, buyQuantity);
                    await this.placeOrUpdateOrder(formattedSymbol, "sell", sellPrice, sellQuantity);
 
                }
            }
        } catch (error) {
            console.error("[adjustMarketMakerOrders] error: ", error);
        } finally {
            this.isAdjusting = false;
        }
    }
    
    async placeOrUpdateOrder(symbol, side, price, quantity) {
        if (this.isInitializing) {
            console.log("系統正在初始化中，跳過下單操作");
            return;
        }

        const pair = `${symbol.toUpperCase()}`.replace("_", "");
        const baseOrderKey = `${symbol}_${side}`;
        const currentPrice = latestTickerData[pair]?.price;
        
        if (!this.orders[baseOrderKey]) {
            this.orders[baseOrderKey] = {};
        }
    
        const allOrders = await this.getOrders();
        const totalOrderCount = allOrders.length;

        if (totalOrderCount > MAX_ORDER * 13.5) {
            console.log(`訂單總數（${totalOrderCount}）超過 ${MAX_ORDER * 13.5}，執行初始化並暫停系統`);
            await this.handleExcessOrders();
            return; 
        }

        if (totalOrderCount > MAX_ORDER * 11) {
            console.log(`訂單總數（${totalOrderCount}）超過 ${MAX_ORDER * 11}，執行初始化`);
            await this.initializeMarketMaker();
            console.log("return")
            return;
        }

        
        for (const orderId in this.orders[baseOrderKey]) {
            let existingOrder = allOrders.find(order => order.orderId === orderId);
    
            if (existingOrder) {
                const orderStatus = existingOrder.status;
                const orderSide = existingOrder.side;
                const orderPrice = existingOrder.price;
                
                const dCurrentPrice = new Decimal(currentPrice);
                const dOrderPrice = new Decimal(orderPrice || 0);
                const priceDifference = dOrderPrice.minus(dCurrentPrice);
                const maxDifference = Decimal.sqrt(dCurrentPrice.div(45));
                // console.log(`訂單 ${orderId} 狀態: ${orderStatus}, 現價: ${currentPrice}, 訂單價: ${orderPrice}, 差價: ${priceDifference} 最大差價: ${maxDifference}`);    
                if ((orderStatus === "open" || orderStatus === "partially_filled")
                    && orderSide === "buy" 
                    && (dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference) || priceDifference.greaterThan(0))) {
                    await this.cancelOrder(orderId, symbol);
                    delete this.orders[baseOrderKey][orderId];
                } else if (
                    (orderStatus === "open" || orderStatus === "partially_filled")
                    && orderSide === "sell"
                    && (dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference) || priceDifference.lessThan(0))) {
                    await this.cancelOrder(orderId, symbol);
                    delete this.orders[baseOrderKey][orderId];
                } else if (
                    orderStatus === "filled" 
                    || orderStatus === "CANCELED" 
                    || orderStatus === "PARTIALLY_FILLED_CANCELED" ) { 
                    console.log(`訂單已完成或已取消，從記錄中刪除: ${orderId}`);
                    delete this.orders[baseOrderKey][orderId];
                }
            } else {
                console.log(`？？？？？沒有找到現有訂單: ${orderId}`);
                delete this.orders[baseOrderKey][orderId];
            }
        }
    
        if (Object.keys(this.orders[baseOrderKey]).length < MAX_ORDER) {
            await this.createOrder(symbol, side, "limit", price, quantity);
        } else {
            console.log(`${baseOrderKey} 已達到最大訂單數 ${MAX_ORDER}，不創建新訂單`);
        }
    }

    

///////////////////////// INITIALIZE MARKET MAKER /////////////////////////
    async initializeMarketMaker() {

        if (this.isInitializing) {
            console.log("初始化已在進行中，跳過本次初始化");
            return;
        }

        this.isInitializing = true;
        console.log("開始初始化市場造市者");
        // this.clearOrdersCache();

        try {
            const existingOrders = await this.getOrders();
            this.orders = {}; 

            for (const order of existingOrders) {
                if (order.status === "open" || order.status === "partially_filled") {
                    const baseOrderKey = `${order.symbol}_${order.side}`;

                    if (!this.orders[baseOrderKey]) {
                        this.orders[baseOrderKey] = {};
                    }

                    if (Object.keys(this.orders[baseOrderKey]).length < MAX_ORDER) {
                        this.orders[baseOrderKey][order.orderId] = {
                            ...order,
                            orderKey: `${baseOrderKey}_${order.orderId}`
                        };
                    } else {
                        await this.cancelOrder(order.orderId, order.symbol);
                    }
                }
            }

            for (const [key, orders] of Object.entries(this.orders)) {
                console.log(`${key}: ${Object.keys(orders).length} 個訂單`);
            }

            // this.lastInitializeTime = currentTime;
        } catch (error) {
            console.error("[initializeMarketMaker] error: ", error);
        } finally {
            console.log("初始化完成，暫停1秒以等待系統處理變更...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("清除快取以重新獲得訂單狀況...");
            this.clearOrdersCache();
            this.isInitializing = false
        }
    } 

    async handleExcessOrders() {
        try {
            await this.initializeMarketMaker();
            console.log("初始化完成，系統將暫停 5 秒");
            

            await new Promise(resolve => setTimeout(resolve, 5000));
            console.log("系統恢復運行");
    
            this.clearOrdersCache();
        } catch (error) {
            console.error("[handleExcessOrders] error:", error);
        }
    }

    async startMarketMaker(){
        console.log("Starting market maker");
        await this.initializeMarketMaker();
        setInterval(() => {
            this.adjustMarketMakerOrders();
        }, 2000);

        setInterval(() => {
            console.log("定期清理（初始化）訂單");
            this.initializeMarketMaker();
        }, 30000);
    }
}

async function main(){
    console.log("Starting main function");
    const marketMaker = new MarketMaker();
    try {
        await marketMaker.login(`${process.env.MARKET_MAKER_EMAIL}`, `${process.env.MARKET_MAKER_PASSWORD}`);
        if (marketMaker.cookies.accessToken) {
            console.log("Market Maker logged in successfully");
            
            await marketMaker.connect();
            // await marketMaker.cancelAllOrders();
            marketMaker.startMarketMaker();
            await new Promise(() => {});
        }
    } catch (error) {
        console.error("[Main] error: ", error);
    }
}

main();