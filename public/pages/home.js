import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus } from "../utils/auth.js";
import homeWebSocket from "../utils/homeWebsocket.js";


document.addEventListener("DOMContentLoaded", () => {
    homeWebSocket.init()
    listenForRecentDetail();
    initializeHeader();
    linkToTradePage();
    generateSignUpForm();
});


function listenForRecentDetail() {
    document.addEventListener("tickerBTC", updateTickerDetail);
    document.addEventListener("tickerETH", updateTickerDetail);
    document.addEventListener("tickerBNB", updateTickerDetail);
    document.addEventListener("tickerAVAX", updateTickerDetail);
    document.addEventListener("tickerDOGE", updateTickerDetail);
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

    const heroContainer = document.querySelector(".hero__container");
    if (heroContainer) {
        heroContainer.appendChild(form);
    } else {
        console.error("Could not find .hero__container element");
    }
}

function linkToTradePage() {
    const btcTradeButton = document.getElementById("symbol-item__btc");
    btcTradeButton.addEventListener("click", () => {
        location.href = "/trade";
    });
}

function updateTickerDetail(event) {
    const recentPrice = event.detail.price; 

    const priceElement = document.getElementById("symbol-item__price--usdt--btc");
    if (priceElement) {
        priceElement.textContent = `${recentPrice} USDT`;
    }

    const priceUsdElement = document.getElementById("symbol-item__price--usd--btc");
    if (priceUsdElement) {
        priceUsdElement.textContent = `≈${recentPrice} USD`;
    }

    const pricePercentElement = document.getElementById("symbol-item__change--btc");
    if (pricePercentElement) {
        const priceChangePercent = event.detail.priceChangePercent;
        pricePercentElement.textContent = `${priceChangePercent.toFixed(2)}%`;

        if (priceChangePercent > 0) {
            pricePercentElement.classList.remove("negative");
            pricePercentElement.classList.add("positive");
        } else if (priceChangePercent < 0) {
            pricePercentElement.classList.remove("positive");
            pricePercentElement.classList.add("negative");
        } else {
            pricePercentElement.classList.remove("positive");
            pricePercentElement.classList.remove("negative");
        }
    }
}