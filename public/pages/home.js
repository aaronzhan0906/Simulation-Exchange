import { initializeHeader } from "../components/headerUI.js";

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    linkToTradePage();
    initializeWebSocket();
    signUpButton();
});

function initializeWebSocket() {
    const wsUrl = `wss://${location.host}/ws`; // 假設您的後端 WebSocket 端點是 /ws
    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WebSocket connection established");
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "ticker") {
                    updatePrice(message.data);
                    console.log(message.data);
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = (event) => {
            console.log("WebSocket connection closed", event.reason);
            if (reconnectAttempts < maxReconnectAttempts) {
                const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                setTimeout(() => {
                    reconnectAttempts++;
                    connect();
                }, timeout);
            } else {
                console.error("Max reconnect attempts reached. Please refresh the page.");
            }
        };
    }

    connect();
}

function signUpButton() {
    const signUpButton = document.getElementById("hero__register--button");
    const form = document.getElementById("hero__register--form");

    form.addEventListener("submit", (event) => {
        event.preventDefault(); 
    });

    signUpButton.addEventListener("click", (event) => {
        event.preventDefault(); 
        const inputEmail = document.getElementById("hero__register--input");
        if (inputEmail.value) {
            localStorage.setItem("email", inputEmail.value);
        }
        window.location.href = "/signup";
    });
}

function linkToTradePage() {
    const btcTradeButton = document.getElementById("symbol-item__btc");
    btcTradeButton.addEventListener("click", () => {
        location.href = "/trade";
    });
}

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