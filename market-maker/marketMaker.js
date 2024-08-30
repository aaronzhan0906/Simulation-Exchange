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

    async adjustMarketMakerOrders() {
        try {
            console.log("Adjusting market maker orders");
            for (const symbol of supportedSymbols) {
                const pair = `${symbol.toUpperCase()}USDT`;
                const formattedSymbol = `${symbol}_usdt`;
                const currentPrice = latestTickerData[pair]?.price;
                if (!currentPrice) {
                    console.log(`No price data for ${pair}, skipping`);
                    continue;
                }

                const precision = this.determinePrecision(currentPrice);
                const spreadPercentage = this.determineSpread(precision);
                console.log(`Precision: ${precision}, Spread: ${spreadPercentage}`);
                const buyPrice = new Decimal(currentPrice).times(1 - spreadPercentage).toFixed(precision);
                const sellPrice = new Decimal(currentPrice).times(1 + spreadPercentage).toFixed(precision);

                const min = 1/Math.pow(10, precision);
                const max = 5/Math.pow(10, precision);
                const quantity = (Math.random() * (max - min) + min).toFixed(precision);

                await this.placeOrUpdateOrder(formattedSymbol, "buy", buyPrice, quantity);
                await this.placeOrUpdateOrder(formattedSymbol, "sell", sellPrice, quantity);
            }
        } catch (error) {
            console.error("Error in [adjustMarketMakerOrders]: ", error);
        }
    }
    determineSpread(precision) {
        if (precision === 5 ) {
            return 0.0001 + (Math.random() * 0.001); // 0.0001 ~ 0.0011
        } else if (precision === 4 || precision === 3 || precision === 2 || precision === 1) { 
            return 0.001 + (Math.random() * 0.01); // 0.001 ~ 0.005
        } 
    }

    determinePrecision(currentPrice) {
        const priceNum = parseFloat(currentPrice);
        const integerDigits = Math.floor(Math.log10(priceNum)) + 1;
        const precision = Math.max(integerDigits, 0);
        return precision;
    }

    async placeOrUpdateOrder(symbol, side, price, quantity) {
        const existingOrder = this.orders[`${symbol}_${side}`];
        if (existingOrder) {
            const { orderStatus, orderSide, orderPrice } = await this.getOrderDetails(existingOrder.orderId);

            // if price difference is more than 0.0005 , cancel and place new order
            if (orderStatus === "open" 
                && orderSide === "buy" 
                && new Decimal(orderPrice).minus(price).abs().greaterThan(0.01) 
                &&  new Decimal(orderPrice).greaterThan(price)) {
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[`${symbol}_${side}`];
            } else if (
                orderStatus === "open" 
                && orderSide === "sell"
                && new Decimal(orderPrice).minus(price).abs().greaterThan(0.0005)
                && new Decimal(orderPrice).lessThan(price)) 
            {
                await this.cancelOrder(existingOrder.orderId, symbol);
                delete this.orders[`${symbol}_${side}`];
            } else if (
                orderStatus === "filled" 
                || orderStatus === "partially_filled" 
                || orderStatus === "CANCEL" 
                || orderStatus === "PARTIALLY_FILLED_CANCELED" ) { 
                delete this.orders[`${symbol}_${side}`];
            } else {
                console.log(`No update needed for ${symbol} ${side}`);
                return;
            }
        }

        const newOrder = await this.createOrder(symbol, side, "limit", price, quantity);
        if (newOrder && newOrder.order) {
            this.orders[`${symbol}_${side}`] = newOrder.order;
        } else {
            console.error(`Failed to place ${side} order for ${symbol}`);
        }
    }

    async getOrderDetails(orderId) {
        try {
            const orders = await this.getOrders();
            const order = orders.find(order => order.orderId === orderId);
            if (order) {
                return {
                    status: order.status,
                    side: order.side,
                    price: order.price
                };
            } else {
                return { status: "NOT_FOUND", side: null, price: null };
            }
        } catch (error) {
            console.error("Error in [getOrderStatus]: ", error);
            return { status: "ERROR", side: null, price: null };
        }
    }

    startMarketMaker(){
        console.log("Starting market maker");
        setInterval(() => {
            console.log("Triggered adjustMarketMakerOrders");
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