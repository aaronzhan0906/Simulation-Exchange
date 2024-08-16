import { initializeHeader } from "../components/headerUI.js";

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();

    const ws = new WebSocket(`wss://${location.host}`);

    ws.onopen = () => {
        console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "ticker") {
            updatePrice(message.data);
            console.log(message.data);
        }
    };

    ws.onerror = (error) => {
        console.log("WebSocket error:", error);
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed");
    };

    function updatePrice(tickerData) {
        const priceElement = document.querySelector(".symbol-item__price--usdt");
        if (priceElement) {
            priceElement.textContent = parseFloat(tickerData.price).toFixed(2);
        }

        const priceUsdElement = document.querySelector(".symbol-item__price--usd");
        if (priceUsdElement) {
            priceUsdElement.textContent = `≈${parseFloat(tickerData.price).toFixed(2)} USD`;
        }

        const pricePercentElement = document.querySelector(".symbol-item__change");
        if (pricePercentElement) {
            const priceChangePercent = parseFloat(tickerData.priceChangePercent);
            pricePercentElement.textContent = `${priceChangePercent.toFixed(2)}%`;

            if (priceChangePercent >= 0) {
                pricePercentElement.classList.remove("negative");
                pricePercentElement.classList.add("positive");
            } else {
                pricePercentElement.classList.remove("positive");
                pricePercentElement.classList.add("negative");
            }
        }
    }
});