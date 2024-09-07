import axios from "axios";
import https from "https";
import dotenv from "dotenv";
import WebSocket from "ws";
import Decimal from "decimal.js";

dotenv.config();
console.log("Environment variables loaded");
const MAX_ORDER = 10;

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
        this.lastInitializeTime = 0;
        this.initializeInterval = 60000;
        console.log("MarketMaker instance created");
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

                case "subscribed":
                    console.log(`Successfully subscribed to ${message.symbol}`);
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
            console.error("WebSocket is not open");
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

    async getOrders(){
        try{
            const response = await this.axiosInstance.get(`${this.url}/api/trade/order`,{
                headers: {
                    Cookie: `accessToken=${this.cookies.accessToken}`
                }
            });
            return response.data.orders || [];
        } catch (error) {
            console.error("[getOrders] error:", error);
            return [];
        }
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
        try {
            console.log(`～～～～～Cancelling order: ${orderId} for ${symbol}`);
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
            console.error(
                (error.response && error.response.status === 401) 
                  ? "[createOrder] error: order has been executed" 
                  : `[createOrder] error: ${error}` 
            );
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

                if (this.orderCount > MAX_ORDER * 20) {
                    console.log(`訂單數量（${this.orderCount}）超過 ${MAX_ORDER * 20}，暫停操作 5 秒`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    console.log("恢復操作");
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
        const pair = `${symbol.toUpperCase()}`.replace("_", "");
        const baseOrderKey = `${symbol}_${side}`;
        const currentPrice = latestTickerData[pair]?.price;
        
        if (!this.orders[baseOrderKey]) {
            this.orders[baseOrderKey] = {};
        }
    
        const allOrders = await this.getOrders();
        const totalOrderCount = allOrders.length;

        if (totalOrderCount > MAX_ORDER * 20) {
            console.log(`訂單總數（${totalOrderCount}）超過 200，執行初始化`);
            await this.initializeMarketMaker();
            
            console.log(`訂單總數（${totalOrderCount}）超過 200，暫停操作 5 秒`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            console.log("恢復操作");
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
            console.log(`＋＋＋＋＋創建新訂單: ${symbol}, ${side}, ${price}, ${quantity}`);
            await this.createOrder(symbol, side, "limit", price, quantity);
        } else {
            console.log(`${baseOrderKey} 已達到最大訂單數 ${MAX_ORDER}，不創建新訂單`);
        }
    }

    

///////////////////////// INITIALIZE MARKET MAKER /////////////////////////
    async initializeMarketMaker() {
        const currentTime = Date.now();
        if (currentTime - this.lastInitializeTime < 90000) {
            console.log(`距離上次初始化時間不足 ${this.initializeInterval / 1000} 秒，跳過本次初始化`);
            return;
        }

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

            this.lastInitializeTime = currentTime;
        } catch (error) {
            console.error("[initializeMarketMaker] error: ", error);
        }
    }

    async startMarketMaker(){
        console.log("Starting market maker");
        await this.initializeMarketMaker();
        setInterval(() => {
            this.adjustMarketMakerOrders();
        }, 3000);

        setInterval(() => {
            console.log("定期清理（初始化）訂單");
            this.initializeMarketMaker();
        }, 90000);
    }


}

async function main(){
    console.log("Starting main function");
    const marketMaker = new MarketMaker();
    try {
        await marketMaker.login(`${process.env.MARKET_MAKER_EMAIL}`, `${process.env.MARKET_MAKER_PASSWORD}`);
        if (marketMaker.cookies.accessToken) {
            console.log("Market Maker logged in successfully");
            // await marketMaker.cancelAllOrders();

            await marketMaker.connect();
            marketMaker.startMarketMaker();
            await new Promise(() => {});
        }
    } catch (error) {
        console.error("[Main] error: ", error);
    }
}

main();

 // async getOrderDetails(orderId) {
    //     try {
    //         const orders = await this.getOrders();
    //         const order = orders.find(order => order.orderId === orderId);
    //         if (order) {
    //             return {
    //                 orderStatus: order.status,
    //                 orderSide: order.side,
    //                 orderPrice: order.price
    //             };
    //         } else {
    //             return { status: "NOT_FOUND", side: null, price: null };
    //         }
    //     } catch (error) {
    //         console.error("[getOrderStatus] error: ", error);
    //         return { status: "ERROR", side: null, price: null };
    //     }
    // }

    // async createOrder(symbol, side, type, price, quantity){
    //     try {
    //         const response = await this.axiosInstance.post(`${this.url}/api/trade/marketMaker/order`, 
    //             { symbol, side, type, price, quantity }, {
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                     "Cookie": `accessToken=${this.cookies.accessToken}`
    //                 }
    //             });
    //         return response.data;
    //     } catch (error) {
    //         console.error("[createOrder] error:", error);
    //     }
    // }


    // async cleanUpOrders(){
    //     for (const symbol of supportedSymbols) {
    //         const pair = `${symbol.toUpperCase()}USDT`;
    //         const formattedSymbol = `${symbol}_usdt`;
    //         const currentPrice = latestTickerData[pair]?.price;
    //         if (!currentPrice) continue;

    //         const allOrders = await this.getOrders();
    //         const symbolOrders = allOrders.filter(order => order.symbol === formattedSymbol);

    //         const buyOrders = symbolOrders.filter(order => order.side === "buy").sort((a, b) => b.price - a.price);
    //         const sellOrders = symbolOrders.filter(order => order.side === "sell").sort((a, b) => a.price - b.price);

    //         const ordersToKeep = new Set([...buyOrders.slice(0, MAX_ORDER), ...sellOrders.slice(0, MAX_ORDER)].map(order => order.orderId));

    //         for (const order of symbolOrders) {
    //             if(!ordersToKeep.has(order.orderId)){
    //                 await this.cancelOrder(order.orderId, formattedSymbol);
    //             }
    //         }
    //     }
    // }