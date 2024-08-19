import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus } from "../utils/auth.js";

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    linkToTradePage();
    initializeWebSocket();
    const signUpForm = generateSignUpForm();
    if (signUpForm) {
        const heroContainer = document.querySelector(".hero__container");
        if (heroContainer) {
            heroContainer.appendChild(signUpForm);
        } else {
            console.error("Could not find .hero__container element");
        }
    }
});



function initializeWebSocket() {
    const wsUrl = `wss://${location.host}/ws`; 
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

function generateSignUpForm() {
    const isLoggedIn = checkLoginStatus();

    // If user is logged in, don't generate the form
    if (isLoggedIn) {
        return null;
    }

    const form = document.createElement("form");
    form.className = "hero__register";
    form.id = "hero__register--form";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "hero__register--input";
    input.id = "hero__register--input";
    input.placeholder = "Email";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hero__register--button";
    button.id = "hero__register--button";
    button.textContent = "Sign Up";

    form.appendChild(input);
    form.appendChild(button);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
    });

    button.addEventListener("click", (event) => {
        event.preventDefault();
        if (input.value) {
            localStorage.setItem("email", input.value);
        }
        window.location.href = "/signup";
    });

    return form;
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