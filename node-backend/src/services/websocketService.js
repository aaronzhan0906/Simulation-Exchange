import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import { parse } from "cookie";
import TradeController from "../controllers/tradeController.js";

class WebSocketService {
    constructor(){
        this.wss = null;
        this.rooms = new Map(); // Map<symbol, Set<ws>>
        this.globalSubscribers = new Set(); 
        this.userSockets = new Map(); // Map<userId, Set<ws>>
    }

    init(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on("connection", (ws, req) => {
            console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);

            ws.isAlive = true;
            ws.rooms = new Set();
            ws.cookieHeader = req.headers.cookie; // for authentication
            
            ws.on("message", (message) => {
                try {
                    console.log("Received", message.toString());
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error("Error handling message:", error);
                    ws.send(JSON.stringify({type: "error", message: "Server error occurred"}));
                }
            });

            ws.on("pong", () => {
                ws.isAlive = true;
            });

            ws.on("close", () => {
                this.cleanupConnection(ws);
            });

            ws.send(JSON.stringify({type: "welcome", message: "Welcome to the WebSocket server!"}));
        });

        this.wss.on("error", (error) => {
            console.error("WebSocket server error:", error);
        });

        // Ping clients every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }


    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            switch (data.action) {
                case "subscribe":
                    if (data.symbol === "ALL") {
                        this.subscribeToAllSymbols(ws);
                    }  else {
                        this.subscribeToRoom(ws, data.symbol);
                    }
                    break;
                    
                case "unsubscribe":
                    if (data.symbol === "ALL") {
                        this.unsubscribeFromAllSymbols(ws);
                    } else {
                        this.unsubscribeFromRoom(ws, data.symbol);
                    }
                    break;

                case "getPersonalData":
                    this.handleAuthenticatedAction(ws, () => {
                        console.log("WS Handling getPersonalData:", ws.userId);
                    });
                    break;

                case "getOrdersByMarketMaker":
                    this.handleAuthenticatedAction(ws, () => {
                        console.log("WS Handling getOrdersByMarketMaker:", ws.userId);
                        TradeController.getOrdersByMarketMaker(ws);
                    })
                    break;

                case "createOrderByMarketMaker":
                    this.handleAuthenticatedAction(ws, () => {
                        console.log("WS Handling createOrderByMarketMaker:", ws.userId);
                        TradeController.createOrderByMarketMaker(ws, data);
                    });
                    break;


                default:
                    console.log("Unknown action:", data.action);
            }
        } catch (error) {
            console.error("WS handleMessage error:", error);
        }
    }

    handleAuthenticatedAction(ws, action) {
        if (!ws.isAuthenticated) {
            this.authenticateConnection(ws);
        }
        
        if (ws.isAuthenticated) {
            action();
        } else {
            ws.send(JSON.stringify({type: "error", message: "Authentication required"}));
        }
    }


    authenticateConnection(ws, req) {

        const cookieHeader = ws.cookieHeader;
        const cookies = cookieHeader ? parse(cookieHeader) : {};
        const accessToken = cookies.accessToken;

        if (accessToken) {
            try {
                const { userId } = jwt.verify(accessToken, config.jwt.accessTokenSecret);
                ws.userId = userId;
                ws.isAuthenticated = true;

                if (!this.userSockets.has(userId)) {
                    this.userSockets.set(userId, new Set());
                }
                this.userSockets.get(userId).add(ws);
            } catch (error) {
                console.error("Invalid token:", error);
                ws.isAuthenticated = false;
            }
        } else {
            ws.isAuthenticated = false;
        }
    }

/////////////////////////  SUBSCRIBE ///////////////////////// 
    subscribeToAllSymbols(ws){
        this.globalSubscribers.add(ws);
        console.log("Subscribed to all symbols");
        ws.send(JSON.stringify({type: "subscribed", symbol: "ALL"}));
    }

    unsubscribeFromAllSymbols(ws) {
        this.globalSubscribers.delete(ws);
        console.log("Unsubscribed from all symbols");
        ws.send(JSON.stringify({type: "unsubscribed", symbol: "ALL"}));
    }

    subscribeToRoom(ws, symbol){
        if(!this.rooms.has(symbol)){
            this.rooms.set(symbol, new Set());
        }
        this.rooms.get(symbol).add(ws);
        ws.rooms.add(symbol);
        console.log(`Subscribed to room ${symbol}`);
        ws.send(JSON.stringify({type: "subscribed", symbol}));      
    }

    unsubscribeFromRoom(ws, symbol){
        if (this.rooms.has(symbol)){
            this.rooms.get(symbol).delete(ws);
            if (this.rooms.get(symbol).size === 0){
                this.rooms.delete(symbol);
            }
        }
        ws.rooms.delete(symbol);
        console.log(`Unsubscribed from ${symbol}`);
        ws.send(JSON.stringify({type: "unsubscribed", symbol}));
    }

    broadcastToRoom(symbol, message) {
        if (this.rooms.has(symbol)) {
            this.rooms.get(symbol).forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    }

    broadcastToAllSubscribers(message) {
        this.globalSubscribers.forEach((client) => {
            if (client.readyState === 1){
                client.send(JSON.stringify(message));
            }
        })
    }

    sendToUser(userId, message) {
        const userSockets = this.userSockets.get(userId);
        if (userSockets) {
            userSockets.forEach(socket => {
                if (socket.readyState === 1) {  
                    socket.send(JSON.stringify(message));
                }
            });
        }
    }
    

/////////////////////////  CLEANUP ///////////////////////// 
    cleanupConnection(ws) {
        ws.rooms.forEach(symbol => {
            if (this.rooms.has(symbol)) {
                this.rooms.get(symbol).delete(ws);
                if (this.rooms.get(symbol).size === 0) {
                    this.rooms.delete(symbol);
                }
            }
        });

        if (ws.userId && this.userSockets.has(ws.userId)) {
            this.userSockets.get(ws.userId).delete(ws);
            if (this.userSockets.get(ws.userId).size === 0) {
                this.userSockets.delete(ws.userId);
            }
        }

        this.globalSubscribers.delete(ws);
        console.log("Cleaned up disconnected WebSocket");
    }


    close(){
        clearInterval(this.heartbeatInterval);
        this.wss.close();
    }

}

export default new WebSocketService();


