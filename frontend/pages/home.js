import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus, checkLoginStatusOnPageLoad } from "../utils/auth.js";
import homeWebSocket from "../services/homeWS.js";


document.addEventListener("DOMContentLoaded", () => {
    // Check login status
    checkLoginStatusOnPageLoad();
    // WS
    homeWebSocket.init()
    // Header
    initializeHeader();
    // Hero Section
    generateSignUpForm();
    // Main
    initSymbolListAndTicker();
});




// HERO SECTION //
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


// MAIN //
async function initSymbolListAndTicker() {
    try {
        const symbolsResponse = await fetch("api/home/symbols");
        const symbolsData = await symbolsResponse.json();
        
        const tickerResponse = await fetch("api/quote/ticker");
        const tickerData = await tickerResponse.json();

        const symbols = symbolsData.data;
        const latestTickerData = tickerData.latestTickerData;

        generateAssetList(symbols, latestTickerData);
        listenForRecentDetail(symbols);

    } catch (error) {
        console.error("Failed to fetch symbols and prices:", error);
    }
}

const generateAssetList = (symbols, latestTickerData) => {
    const symbolListContainer = document.getElementById("symbol-list__container");
    
    symbols.forEach(symbol => {
        const item = document.createElement("div");
        item.className = `symbol-item symbol-item--${symbol.symbolName}`;
        item.id = `symbol-item__${symbol.symbolName}`;
    
        // name
        const nameDiv = document.createElement("div");
        nameDiv.className = "symbol-item__name";
        const img = document.createElement("img");
        img.src = symbol.imageUrl;
        img.alt = symbol.symbolName;
        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${symbol.symbolName.toUpperCase()}/USDT`;
        nameDiv.appendChild(img);
        nameDiv.appendChild(nameSpan);

        // price
        const priceDiv = document.createElement("div");
        priceDiv.className = "symbol-item__price";
        const usdtSpan = document.createElement("span");
        usdtSpan.className = "symbol-item__price--usdt";
        usdtSpan.id = `symbol-item__price--usdt--${symbol.symbolName}`;
        const usdSpan = document.createElement("span");
        usdSpan.className = "symbol-item__price--usd";
        usdSpan.id = `symbol-item__price--usd--${symbol.symbolName}`;
        priceDiv.appendChild(usdtSpan);
        priceDiv.appendChild(usdSpan);

        // change percent
        const changeDiv = document.createElement("div");
        changeDiv.className = "symbol-item__change";
        changeDiv.id = `symbol-item__change--${symbol.symbolName}`;

        // action
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "symbol-item__actions";
        const linkSpan = document.createElement("span");
        linkSpan.className = "symbol-item__link";
        linkSpan.textContent = "Spot Trade";
        actionsDiv.appendChild(linkSpan);

        // append to item
        item.appendChild(nameDiv);
        item.appendChild(priceDiv);
        item.appendChild(changeDiv);
        item.appendChild(actionsDiv);
        symbolListContainer.appendChild(item);

        // link to trade page
        item.addEventListener("click", () => {
            location.href = `/trade/${symbol.symbolName}_usdt`;
        })

        // hr
        if (symbol !== symbols[symbols.length - 1]){
            const hr = document.createElement("hr");
            symbolListContainer.appendChild(hr);
        }

        // update price and style
        const ticker = latestTickerData[`${symbol.symbolName.toUpperCase()}USDT`];
        if (ticker) {
            usdtSpan.textContent = `${parseFloat(ticker.price).toFixed(2)} USDT`;
            usdSpan.textContent = `≈${parseFloat(ticker.price).toFixed(2)} USD`;
            changeDiv.textContent = `${parseFloat(ticker.priceChangePercent).toFixed(2)}%`;
            updatePriceChangeStyle(changeDiv, ticker.priceChangePercent);
        }
    })
}




function listenForRecentDetail(symbols) {
    symbols.forEach(symbol => {
        document.addEventListener(`ticker${symbol.symbolName.toUpperCase()}`, updateTickerDetail);
    });
}

function updateTickerDetail(event) {
    const pair = event.type.replace("ticker", "").toLowerCase();
    const { price, priceChangePercent } = event.detail;

    const priceElement = document.getElementById(`symbol-item__price--usdt--${pair}`);
    if (priceElement) {
        priceElement.textContent = `${parseFloat(price).toFixed(2)} USDT`;
    }

    const priceUsdElement = document.getElementById(`symbol-item__price--usd--${pair}`);
    if (priceUsdElement) {
        priceUsdElement.textContent = `≈${parseFloat(price).toFixed(2)} USD`;
    }

    const pricePercentElement = document.getElementById(`symbol-item__change--${pair}`);
    if (pricePercentElement) {
        pricePercentElement.textContent = `${parseFloat(priceChangePercent).toFixed(2)}%`;
        updatePriceChangeStyle(pricePercentElement, priceChangePercent);
    }
}


function updatePriceChangeStyle(element, priceChangePercent) {
    if (parseFloat(priceChangePercent) > 0) {
        element.classList.remove("negative");
        element.classList.add("positive");
    } else if (parseFloat(priceChangePercent) < 0) {
        element.classList.remove("positive");
        element.classList.add("negative");
    } else {
        element.classList.remove("positive");
        element.classList.remove("negative");
    }
}