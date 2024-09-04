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
        this.url = process.env.TARGET_URL;
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
                
                for (let i = 0; i < 5; i++) {
                    const baseSpread = Math.pow(10, -precision-1) * i * 5;
                    const buySpread = baseSpread + (Math.random() * Math.pow(10, -precision));
                    const sellSpread = baseSpread + (Math.random() * Math.pow(10, -precision));
        
                    const buyPrice = new Decimal(currentPrice).times(1 - buySpread).toFixed(2);
                    const sellPrice = new Decimal(currentPrice).times(1 + sellSpread).toFixed(2);
        
                    const min = 5/Math.pow(10, precision);
                    const max = 7500/Math.pow(10, precision);
                    const buyQuantity = (Math.random() * (max - min) + min).toFixed(precision);
                    const sellQuantity = (Math.random() * (max - min) + min).toFixed(precision);
                    

                    await this.placeOrUpdateOrder(formattedSymbol, "buy", buyPrice, buyQuantity, i);
                    await this.placeOrUpdateOrder(formattedSymbol, "sell", sellPrice, sellQuantity, i);
 
                }
            }
        } catch (error) {
            console.error("[adjustMarketMakerOrders] error: ", error);
        }
    }
    
    async placeOrUpdateOrder(symbol, side, price, quantity, orderIndex) {
        const pair = `${symbol.toUpperCase()}`.replace("_", "");
        const orderKey = `${symbol}_${side}_${orderIndex}`;
        const currentPrice = latestTickerData[pair]?.price;

        const allOrders = await this.getOrders();

        let existingOrder = allOrders.find(order => 
            order.orderId === this.orders[orderKey]?.orderId
        );
            
        if (existingOrder) {
            const orderStatus = existingOrder.status;
            const orderSide = existingOrder.side;
            const orderPrice = existingOrder.price;
        
            const dCurrentPrice = new Decimal(currentPrice);
            const dOrderPrice = new Decimal(orderPrice || 0);
            const priceDifference = dOrderPrice.minus(dCurrentPrice);
            const priceDifferenceAbs = priceDifference.abs();
            const maxDifference = priceDifferenceAbs.times(2);
    
            if ((orderStatus === "open" || orderStatus === "partially_filled")
                && orderSide === "buy" 
                && (dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference) || priceDifference.greaterThan(0))) {
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[orderKey];
            } else if (
                (orderStatus === "open" || orderStatus === "partially_filled")
                && orderSide === "sell"
                && (dOrderPrice.minus(dCurrentPrice).abs().greaterThan(maxDifference) || priceDifference.lessThan(0))) {
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[orderKey];
            } else if (
                orderStatus === "filled" 
                || orderStatus === "CANCEL" 
                || orderStatus === "PARTIALLY_FILLED_CANCELED" ) { 
                delete this.orders[orderKey];
            } else {
                console.log(`${symbol} ${side} order #${orderIndex} does not need updating`);
                return;
            }
        }
    
        console.log(`Creating a new ${side} order #${orderIndex}: ${symbol}, price: ${price}, quantity: ${quantity}`);
        const newOrder = await this.createOrder(symbol, side, "limit", price, quantity);
        if (newOrder && newOrder.order) {
            this.orders[orderKey] = newOrder.order;
        } else {
            console.error(`Failed to create ${symbol} ${side} order #${orderIndex}`);
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
            this.orders = {}; // reset orders

            for (const order of existingOrders) {
                if (order.status === "open" || order.status === "partially_filled") {
                    const symbol = order.symbol;
                    const side = order.side;
                    
                    const currentOrderCount = Object.values(this.orders).filter( 
                        o => o.symbol === symbol && o.side === side
                    ).length;

                    if (currentOrderCount < 5){
                        let orderIndex = 0;
                        while(this.orders[`${symbol}_${side}_${orderIndex}`]){
                            orderIndex++;
                        }

                        const key = `${symbol}_${side}_${orderIndex}`;
                        this.orders[key] = order;
                    }  else  {
                        console.log(`Skipping order ${order.orderId} ${ order.symbol } with status: ${order.status}`);
                        await this.cancelOrder(order.orderId, order.symbol);
                    }
                }
            } 
        } catch (error) {
            console.error("Error in [initializeMarketMaker]: ", error);
        }
    }

    async startMarketMaker(){
        console.log("Starting market maker");
        await this.initializeMarketMaker();
        setInterval(() => {
            this.adjustMarketMakerOrders();
        }, 7000);
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