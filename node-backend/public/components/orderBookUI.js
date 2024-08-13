const tradeWebSocket = {
    ws: null,

    init() {
        this.ws = new WebSocket(`wss://${location.host}`);
        this.setupWebSocketHandlers();
    },

    setupWebSocketHandlers() {
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
        this.ws.onclose = this.onClose.bind(this);
    },

    onOpen() {
        console.log("WebSocket connection established");
    },

    onMessage(event) {
        const message = JSON.parse(event.data);
        if (message.type === "ticker") {
            this.emitRecentPrice(message.data.price);
        } else if (message.type === "orderbook") {
            this.updateOrderBookUI(message.data);
        }
    },

    emitRecentPrice(price){
        const event = new CustomEvent("recentPrice", { detail: { price: new Decimal(price) }});
        document.dispatchEvent(event);
    },

    onError(error) {
        console.log("WebSocket error:", error);
    },

    onClose() {
        console.log("WebSocket connection closed");
    },

   

    updateOrderBookUI(orderBookData) {
        // console.log("Order book:", orderBookData);
        // 實現訂單簿更新邏輯
    }
};

export default tradeWebSocket;