import { initializeHeader } from "../components/header.js";

document.addEventListener("DOMContentLoaded", (event) => {
    initializeHeader();




    const ws = new WebSocket(`wss://${location.host}`);

ws.onopen = function() {
    console.log("WebSocket connection established");
};

ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    if (message.type === "ticker") {
        updatePrice(message.data);
    } else if (message.type === "orderbook") {
        updateOrderBookUI(message.data);
    }
};

ws.onerror = function(error) {
    console.log("WebSocket error:", error);
};

ws.onclose = function() {
    console.log("WebSocket connection closed");
};

let lastPrice = null;
function updatePrice(tickerData) {
    const priceElement = document.querySelector(".order-book__price");
    if (priceElement) {
        const currentPrice = parseFloat(tickerData.price);
        priceElement.textContent = currentPrice.toFixed(2);
        
        if (lastPrice !== null) {
            if (currentPrice > lastPrice) {
                priceElement.classList.remove("negative");
                priceElement.classList.add("positive");
            } else if (currentPrice < lastPrice) {
                priceElement.classList.remove("positive");
                priceElement.classList.add("negative");
            }
        }
        lastPrice = currentPrice;
    }
    
    const priceUsdElement = document.querySelector(".order-book__price--usd");
    if (priceUsdElement) {
        priceUsdElement.textContent = `≈${parseFloat(tickerData.price).toFixed(2)} USD`;
    }

    const inputElement = document.querySelector(".trade-panel__input");
    if (inputElement) {
        inputElement.placeholder = currentPrice.toFixed(2);
    }
}


function updateOrderBookUI(orderBookData){
    console.log("Order book:", orderBookData);
}
});
