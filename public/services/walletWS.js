class WalletWebSocket {
    constructor() {
        this.ws = null;
        this.assets = [];
    }

    init(assets) {
        this.assets = assets;
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
        this.subscribeToAssets();
    }

    subscribeToAssets(){
        this.assets.forEach(asset => {
            const symbol = `${asset}_usdt`; 
            this.ws.send(JSON.stringify({ action: "subscribe", symbol }));
        })
    }

    onMessage(event) {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case "welcome":
                console.log("Received welcome message");
                break;

            case "subscribed":
                console.log(`Successfully subscribed to ${message.symbol}`);
                break;

            case "ticker":
                this.emitPriceUpdate(message)
                break;
        }
    }

    emitPriceUpdate(data){
        const event = new CustomEvent("priceUpdate", {
            detail: {
                symbol: data.symbol,
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
        setTimeout(() => this.init(this.assets), 5000);
    }
}

export default new WalletWebSocket();