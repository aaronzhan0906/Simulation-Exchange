import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus } from "../utils/auth.js";
import walletWebSocket from "../services/walletWS.js";

let assets = [];
let usdtBalance = new Decimal(0);
let assetElements = new Map();

// BALANCE OVERVIEW // ( and balance )
async function initBalanceOverview () {
    const isLoggedIn = checkLoginStatus();
    const balanceValueAvailable = document.getElementById("balance-value__available");
    const balanceValueLocked = document.getElementById("balance-value__locked");
    const balanceValueTotal = document.getElementById("balance-value__total");
    const balanceValueProfit = document.getElementById("balance-value__profit");
    const assetItemAmount = document.getElementById("asset-item__amount--fixed");
    const assetItemAvailable = document.getElementById("asset-item__available--fixed");

    if (!isLoggedIn) {
        balanceValueTotal.textContent = "******" 
        balanceValueProfit.textContent = "******"
        assetItemAmount.textContent = "******"
        assetItemAvailable.textContent = "******"
        balanceValueAvailable.textContent = "*****"
        balanceValueLocked.textContent = "*****"
        return;
    };

    try {
        const response = await fetch("/api/wallet/balanceOverView");
        const data = await response.json();
        
        if (response.ok){
            const available = new Decimal(data.available ?? 0); // if no balance or 0, return 0
            const locked = new Decimal(data.locked ?? 0); // if no balance or 0, return 0
            const balance = new Decimal(data.balance ?? 0); // if no balance or 0, return 0

            assetItemAmount.textContent = `${balance.toFixed(2)} USDT`
            assetItemAvailable.textContent = `${available.toFixed(2)} USDT`
            balanceValueAvailable.textContent = `${available.toFixed(2)} USDT`;
            balanceValueLocked.textContent = `${locked.toFixed(2)} USDT`;

            return balance;
        }
    } catch (error) {
        console.error("Error in initBalanceOverview():",error);
    }
}


// MY ASSETS //
async function initAssets() { 
    try {
        usdtBalance = await initBalanceOverview();

        const assetsResponse = await fetch("/api/wallet/assetsAndSymbols");
        const assetsData = await assetsResponse.json();
 
        const tickerResponse = await fetch("/api/quote/ticker");
        const tickerData = await tickerResponse.json();

        const assetListContainer = document.getElementById("asset-list__container");
        assetElements = new Map();

        assets = assetsData.assets.map(asset => {
            const ticker = tickerData.latestTickerData[`${asset.symbol.toUpperCase()}USDT`];
            return {
                ...asset,
                currentPrice: new Decimal(ticker.price ?? 0),
                priceChangePercent: new Decimal(ticker.priceChangePercent ?? 0)
            };
        }).filter(asset => !new Decimal(asset.amount ?? 0).isZero());

        assets.forEach(asset => {
            const { assetItem, priceDiv, changeDiv } = createAssetElement(asset);
            assetListContainer.appendChild(assetItem);
            assetElements.set(asset.symbol.toLowerCase(), { priceDiv, changeDiv });
        });

        // Initialize WebSocket connection
        walletWebSocket.init(assets.map(asset => asset.symbol));
        document.addEventListener("priceUpdate", handlePriceUpdate);

        // Initial calculation
        calculateTotalAssetAndProfit();

        // Set up interval for updating data every 3 seconds
        setInterval(updateAllData, 3000);
    } catch (error) {
        console.error("Error in initAssets():", error);
    }
}

function createAssetElement(asset) {
    const assetListContainer = document.getElementById("asset-list__container");

    const assetItem = document.createElement("div");
    assetItem.classList.add("asset-item");
    assetItem.addEventListener("click", () => 
        {window.location.href = `${window.location.origin}/trade/${asset.symbol.toLowerCase()}_usdt`});


    // symbol 
    const symbolDiv = document.createElement("div");
    symbolDiv.classList.add("asset-item__symbol");
    const img = document.createElement("img");
    img.src = asset.imageUrl;
    img.alt = `${asset.symbol} icon`;
    const symbolSpan = document.createElement("span");
    symbolSpan.textContent = (asset.symbol).toUpperCase();
    symbolDiv.appendChild(img);
    symbolDiv.appendChild(symbolSpan);
    assetItem.appendChild(symbolDiv);

    // amount
    const amountDiv = document.createElement("div");
    amountDiv.classList.add("asset-item__amount");
    amountDiv.textContent = `${new Decimal(asset.amount ?? 0).toFixed(5)} ${(asset.symbol).toUpperCase()}`;
    assetItem.appendChild(amountDiv);

    // available 
    const availableDiv = document.createElement("div");
    availableDiv.classList.add("asset-item__available");
    availableDiv.textContent = `${new Decimal(asset.availableQuantity ?? 0).toFixed(5)} ${(asset.symbol).toUpperCase()}`;
    assetItem.appendChild(availableDiv);

    // average-cost 
    const avgCostDiv = document.createElement("div");
    avgCostDiv.classList.add("asset-item__average-cost");
    avgCostDiv.textContent = `${new Decimal(asset.averagePrice ?? 0).toFixed(2)} USDT`;
    assetItem.appendChild(avgCostDiv);

    // price 
    const priceDiv = document.createElement("div");
    priceDiv.classList.add("asset-item__price");
    priceDiv.textContent = `${new Decimal(asset.currentPrice ?? 0).toFixed(2)} USDT`;
    assetItem.appendChild(priceDiv); 

    // change 
    const changeDiv = document.createElement("div");
    changeDiv.classList.add("asset-item__change");
    changeDiv.textContent = `${new Decimal(asset.priceChangePercent ?? 0).toFixed(2)}%`;
    updatePriceChangeStyle(changeDiv, asset.priceChangePercent);
    assetItem.appendChild(changeDiv);

    // action
    const actionDiv = document.createElement("div");
    actionDiv.classList.add("asset-item__action");

    const actionLink = document.createElement("a");
    actionLink.textContent = "Spot trade";
    actionLink.classList.add("asset-item__link")

    actionDiv.appendChild(actionLink);
    assetItem.appendChild(actionDiv);

    assetListContainer.appendChild(assetItem);
    return { assetItem, priceDiv, changeDiv };
}

function handlePriceUpdate(event) {
    const { symbol, price, priceChangePercent } = event.detail;
    const baseSymbol = symbol.slice(0, -4).toLowerCase();
    const elements = assetElements.get(baseSymbol);
    if (elements) {
        const asset = assets.find(a => a.symbol.toLowerCase() === baseSymbol);
        if (asset) {
            asset.currentPrice = new Decimal(price);
            asset.priceChangePercent = new Decimal(priceChangePercent);
        }
    }
}

function updateAllData() {
    assets.forEach(asset => {
        const elements = assetElements.get(asset.symbol.toLowerCase());
        if (elements) {
            elements.priceDiv.textContent = `${asset.currentPrice.toFixed(2)} USDT`;
            elements.changeDiv.textContent = `${asset.priceChangePercent.toFixed(2)}%`;
            updatePriceChangeStyle(elements.changeDiv, asset.priceChangePercent);
        }
    });

    calculateTotalAssetAndProfit();
}


function updatePriceChangeStyle(element, priceChangePercent) {
    if (priceChangePercent >= 0) {
        element.classList.remove("negative");
        element.classList.add("positive");
    } else {
        element.classList.remove("positive");
        element.classList.add("negative");
    }
}

function calculateTotalAssetAndProfit() {
    let totalAssetValue = new Decimal(usdtBalance);

    assets.forEach(asset => {
        const amount = new Decimal(asset.amount ?? 0);
        const assetValue = amount.times(asset.currentPrice);
        totalAssetValue = totalAssetValue.plus(assetValue);
    });

    const profitValue = totalAssetValue.minus(new Decimal(10000)).div(new Decimal(10000));

    updateTotalAsset(totalAssetValue);
    updateTotalProfit(profitValue);
}

function updateTotalAsset(totalAsset) {
    const balanceValueTotal = document.getElementById("balance-value__total");
    balanceValueTotal.textContent = `${totalAsset.toFixed(2)} USDT`;
}

function updateTotalProfit(totalProfit) {
    const balanceValueProfit = document.getElementById("balance-value__profit");
    const roundedProfit = totalProfit.times(100).toDecimalPlaces(2);
    
    if (totalProfit.greaterThan(0)) {
        balanceValueProfit.textContent = `${roundedProfit.toFixed(2)} %`;
        balanceValueProfit.classList.add("positive");
        balanceValueProfit.classList.remove("negative");
    } else if (totalProfit.lessThan(0)) {
        balanceValueProfit.textContent = `${roundedProfit.toFixed(2)} %`;
        balanceValueProfit.classList.remove("positive");
        balanceValueProfit.classList.add("negative");
    } else {
        balanceValueProfit.textContent = `0.00 %`;
        balanceValueProfit.classList.remove("positive");
        balanceValueProfit.classList.remove("negative");
    }
}


document.addEventListener("DOMContentLoaded", async () => {
    initializeHeader();
    // BALANCE OVERVIEW //
    await initBalanceOverview ()
    await initAssets();
});