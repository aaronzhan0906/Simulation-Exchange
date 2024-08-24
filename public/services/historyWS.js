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

    // if open orders 
    requestPersonalData(){
        console.log("requesting personal data");
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ action: "getPersonalData"}));
        } else {
            console.error("WebSocket is not open. Unable to request personal data.");
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

            case "orderUpdate":
                console.log("Order update:", message.data);
                this.emitOrderUpdate(message.data);

                break;

            case "error":
                console.error("WS error:", message.message);
                break;
            
            default:
                console.log("Unhandled message type:", message.type);
        }
    }

    emitOrderUpdate(orderUpdateData) {
        const event = new CustomEvent("orderUpdate", { detail: orderUpdateData });
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