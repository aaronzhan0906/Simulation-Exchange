const pair = location.pathname.split("/")[2];
const baseAsset = pair.split("_")[0];
class TradeWebSocket {
    constructor() {
        this.ws = null;
    }

    init() {
        this.ws = new WebSocket(`wss://${location.host}`);
        this.setupWebSocketHandlers();
    }

    setupWebSocketHandlers() {
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    }

    onOpen() {
        console.log("WebSocket connected");
        if (pair) {
            this.ws.send(JSON.stringify({ action: "subscribe", symbol: pair })); // subscribe ticker
        }
    }

    onMessage(event) {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case "welcome":
                break;

            case "subscribed":

                console.log(`Successfully subscribed to ${message.symbol}`);
                break;
    

            case "ticker":
                // {type: 'ticker', symbol: 'ETHUSDT', price: '2578.79000000', priceChangePercent: '-2.406'}
                this.emitRecentPrice(message.price);
                break;

            case "orderBook":
                this.emitOrderBook(message.data);
                break;

            case "orderUpdate":
                this.emitOrderUpdate(message.data);

                break;

            case "recentTrade":
                this.emitRecentTrade(message.data);
                break;
            
            default:
                console.log("Unhandled message type:", message.type);
        }
    }

    emitRecentPrice(price) {
        const event = new CustomEvent("recentPrice", { detail: { price: new Decimal(price) }});
        document.dispatchEvent(event);
    }

    emitOrderBook(orderBookData) {
        const event = new CustomEvent("orderBook", { detail: orderBookData });
        document.dispatchEvent(event);
    }

    emitOrderUpdate(orderUpdateData) {
        const event = new CustomEvent("orderUpdate", { detail: orderUpdateData });
        document.dispatchEvent(event);
    }

    emitRecentTrade(recentTradeData){
        const event = new CustomEvent("recentTrade", {detail: recentTradeData});
        document.dispatchEvent(event);
    }
    
    onError(error) {
        console.log("WS error:", error);
    }

    onClose() {
        console.log("WS connection closed");
        setTimeout(() => this.init(), 5000);
    }
}

export default new TradeWebSocket();