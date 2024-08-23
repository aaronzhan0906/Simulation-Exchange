import Decimal from 'https://cdn.jsdelivr.net/npm/decimal.js/decimal.mjs';


class HomeWebSocket {
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
        this.ws.send(JSON.stringify({ action: "subscribe", symbol: "ALL" }));
        console.log("WS connection opened");
    }

    onMessage(event) {
        const message = JSON.parse(event.data);
        if (message.type.startsWith("ticker")) {
        }

        switch (message.type) {
            case "welcome":
                break;

            case "tickerBTC":
            case "tickerETH":
            case "tickerBNB":
            case "tickerTON":
            case "tickerAVAX":
                this.emitRecentDetail(message.type, message.data);
                break;
            
            default:
                console.log("Unhandled message type:", message.type);
        }
    }

    emitRecentDetail(type, data) {
        const event = new CustomEvent(type, { 
            detail: { 
                price: new Decimal(data.price),
                priceChangePercent: new Decimal(data.priceChangePercent)
            }
        });
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

export default new HomeWebSocket();