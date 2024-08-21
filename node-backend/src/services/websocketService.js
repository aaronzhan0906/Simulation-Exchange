import { WebSocketServer } from "ws";

class WebSocketService {
    constructor(){
        this.wss = null;
        this.rooms = new Map(); // Map<symbol, Set<ws>>
        this.globalSubscribers = new Set(); 
    }

    init(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on("connection", (ws, req) => {
            console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);

            ws.isAlive = true;
            ws.rooms = new Set();

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
                default:
                    console.log("Unknown action:", data.action);
            }
        } catch (error) {
            console.error("WS handleMessage error:", error);
        }
    }

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
        if (this.rooms.has(symbol)){
            this.rooms.get(symbol).forEach((client) => {
                if (client.readyState === 1){
                    client.send(JSON.stringify(message));
                }
            })
        }
        
        // send to all symbols subscribers
        this.globalSubscribers.forEach((client) => {
            if (client.readyState === 1){
                client.send(JSON.stringify(message));
            }
        })
    }

    broadcastToAllSubscribers(message) {
        this.globalSubscribers.forEach((client) => {
            if (client.readyState === 1){
                client.send(JSON.stringify(message));
            }
        })
    }

    cleanupConnection(ws) {
        ws.rooms.forEach(symbol => {
            if (this.rooms.has(symbol)) {
                this.rooms.get(symbol).delete(ws);
                if (this.rooms.get(symbol).size === 0) {
                    this.rooms.delete(symbol);
                }
            }
        });

        this.globalSubscribers.delete(ws);
        console.log("Cleaned up disconnected WebSocket");
    }


    close(){
        clearInterval(this.heartbeatInterval);
        this.wss.close();
    }

}

export default new WebSocketService();


