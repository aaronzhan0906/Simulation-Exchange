import axios from "axios";
import https from "https";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

class MarketMaker {
    constructor(){
        this.url = "https://localhost:9091";
        this.cookies = {};
        this.axiosInstance = axios.create({ // reject ssl certificate
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
        });
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

            console.log("Login success");
            return response.data;
        } catch (error) {
            console.error("Login failed:", error.message);
            throw error;
        }
    }

    async createOrder(symbol, side, type, price, quantity){
        try {
            const response = await this.axiosInstance.post(`${this.url}/api/trade/order`, 
                { symbol, side, type, price, quantity }, {
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": `accessToken =${this.cookies.accessToken}`
                    }
                });
            return response.data;
        } catch (error) {
        console.error("Error in [createOrder]: ", error);
        }
    }


}

async function main(){
    const marketMaker = new MarketMaker();
    try {
        await marketMaker.login(`${process.env.MARKET_MAKER_EMAIL}`, `${process.env.MARKET_MAKER_PASSWORD}`);
        if (marketMaker.cookies.accessToken) {
            console.log("Market Maker logged in successfully");
        }

        const orderResult = await marketMaker.createOrder(
            "btc_usdt", 
            "buy",
            "limit",
            "50000",
            "0.0001"
        )

        if (orderResult) {
            console.log("Order created successfully");
        }
    } catch (error) {
        console.error("Error in main: ", error);
    }
}

main();