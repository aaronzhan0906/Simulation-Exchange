const ws = new WebSocket(`wss://${location.host}`);

ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    switch(message.type) {
        case "ticker":
            updateTickerUI(message.data);
            break;
        case "orderbook":
            updateOrderBookUI(message.data);
            break;
        default:
            console.log(message.type);
    }
}

function updateTickerUI(tickerData){
    console.log("Ticker:", tickerData);
}

function updateOrderBookUI(orderBookData){
    console.log("Order book:", orderBookData);
}