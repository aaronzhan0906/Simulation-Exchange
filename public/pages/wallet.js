import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus } from "../utils/auth.js";
import walletWebSocket from "../services/walletWS.js";




// BALANCE OVERVIEW // ( and balance )
async function initBalanceOverview () {
    const isLoggedIn = checkLoginStatus();
    const balanceValueAvailable = document.getElementById("balance-value__available");
    const balanceValueLocked = document.getElementById("balance-value__locked");
    const assetItemAmount = document.getElementById("asset-item__amount--fixed");
    const assetItemAvailable = document.getElementById("asset-item__available--fixed");

    

    if (!isLoggedIn) {
        assetItemAmount.textContent = "*********"
        assetItemAvailable.textContent = "*********"
        balanceValueAvailable.textContent = "*********"
        balanceValueLocked.textContent = "*********"
        return;
    };

    try {
        const response = await fetch("/api/wallet/balanceOverView");
        const data = await response.json();
        
        if (response.ok){
            const available = new Decimal(data.available || 0); // if no balance or 0, return 0
            const locked = new Decimal(data.locked || 0); // if no balance or 0, return 0
            const balance = new Decimal(data.balance || 0); // if no balance or 0, return 0

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
        const usdtBalance = await initBalanceOverview();

        const assetsResponse = await fetch("/api/wallet/assetsAndSymbols");   // Fetch asset list
        const assetsData = await assetsResponse.json();
 
        const tickerResponse = await fetch("/api/quote/ticker");        // Fetch latest ticker data
        const tickerData = await tickerResponse.json();

        const assetListContainer = document.getElementById("asset-list__container");
        const assetElements = new Map(); // { symbol: { priceDiv, changeDiv } } to subscribe room

        let totalAsset = new Decimal(0);
        let totalProfit = new Decimal(0);

        assetsData.assets.forEach(asset => {
            const ticker = tickerData.latestTickerData[`${asset.symbol.toUpperCase()}USDT`]; // xxx -> XXXUSDT to get ticker data

            const amount = new Decimal(asset.amount || 0); // 之後處理，如果賣光應該要不出現
            const averageCost = new Decimal(asset.averagePrice);
            const recentPrice = new Decimal(ticker.price);

            const assetValue = amount.times(recentPrice)
            const profitValue = amount.mul(recentPrice).sub(amount.mul(averageCost)).mul(100).div(new Decimal(10000));


            totalAsset = assetValue.plus(totalAsset).plus(usdtBalance);
            totalProfit = profitValue.plus(totalProfit);
        
            const combinedData = {
                ...asset,
                currentPrice: ticker.price,
                priceChangePercent: ticker.priceChangePercent,  
            }

            const { assetItem, priceDiv, changeDiv } = createAssetElement(combinedData);
            assetListContainer.appendChild(assetItem);
            assetElements.set(asset.symbol.toLowerCase(), { priceDiv, changeDiv });

            // Update UI with latest ticker data
            if (ticker) {
                priceDiv.textContent = `${new Decimal(ticker.price).toFixed(2)} USDT`;
                changeDiv.textContent = `${new Decimal(ticker.priceChangePercent).toFixed(2)}%`;
            }
        });

        // Update total asset and profit/less
        updateTotalAsset(totalAsset);
        updateTotalValue(totalProfit);

        // Initialize WebSocket connection
        walletWebSocket.init(assetsData.assets.map(asset => asset.symbol));
        document.addEventListener("priceUpdate", (event) => {
            const { symbol, price, priceChangePercent } = event.detail;
            const baseSymbol = symbol.slice(0, -4).toLowerCase();
            const elements = assetElements.get(baseSymbol);
            if (elements) {
                elements.priceDiv.textContent = `${price.toFixed(2)} USDT`;
                elements.changeDiv.textContent = `${priceChangePercent.toFixed(2)}%`;
                updatePriceChangeStyle(elements.changeDiv, priceChangePercent);
            }
        });
    } catch (error) {
        console.error("Error in initAssets():", error);
    }
}

function createAssetElement(asset) {
    const assetListContainer = document.getElementById("asset-list__container");

    const assetItem = document.createElement("div");
    assetItem.classList.add("asset-item");

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
    amountDiv.textContent = `${new Decimal(asset.amount || 0).toFixed(5)} ${(asset.symbol).toUpperCase()}`;
    assetItem.appendChild(amountDiv);

    // available 
    const availableDiv = document.createElement("div");
    availableDiv.classList.add("asset-item__available");
    availableDiv.textContent = `${new Decimal(asset.availableQuantity || 0).toFixed(5)} ${(asset.symbol).toUpperCase()}`;
    assetItem.appendChild(availableDiv);

    // average-cost 
    const avgCostDiv = document.createElement("div");
    avgCostDiv.classList.add("asset-item__average-cost");
    avgCostDiv.textContent = `${new Decimal(asset.averagePrice || 0).toFixed(2)} USDT`;
    assetItem.appendChild(avgCostDiv);

    // price 
    const priceDiv = document.createElement("div");
    priceDiv.classList.add("asset-item__price");
    priceDiv.textContent = `${new Decimal(asset.currentPrice || 0).toFixed(2)} USDT`;
    assetItem.appendChild(priceDiv); 

    // change 
    const changeDiv = document.createElement("div");
    changeDiv.classList.add("asset-item__change");
    changeDiv.textContent = `${new Decimal(asset.priceChangePercent || 0).toFixed(2)}%`;
    updatePriceChangeStyle(changeDiv, asset.priceChangePercent);
    assetItem.appendChild(changeDiv);

    // action
    const actionDiv = document.createElement("div");
    actionDiv.classList.add("asset-item__action");

    const actionLink = document.createElement("a");
    actionLink.textContent = "Spot trade";
    actionLink.classList.add("asset-item__link")
    actionLink.href = `${window.location.origin}/trade/${asset.symbol.toLowerCase()}_usdt`;

    actionDiv.appendChild(actionLink);
    assetItem.appendChild(actionDiv);

    assetListContainer.appendChild(assetItem);
    return { assetItem, priceDiv, changeDiv };
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

function updateTotalAsset(totalAsset) {
    const balanceValueTotal = document.getElementById("balance-value__total");
    balanceValueTotal.textContent = `${totalAsset.toFixed(2)} USDT`;
}

function updateTotalValue(totalProfit) {
    const balanceValueProfit = document.getElementById("balance-value__profit");
    balanceValueProfit.textContent = `${totalProfit.toFixed(2)} %`;
    if (totalProfit.greaterThan(0)) {
        balanceValueProfit.classList.add("positive");
        balanceValueProfit.classList.remove("negative");
    } else if (totalProfit.lessThan(0)) {
        balanceValueProfit.classList.remove("positive");
        balanceValueProfit.classList.add("negative");
    } else {
        balanceValueProfit.classList.remove("positive");
        balanceValueProfit.classList.remove("negative");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    // BALANCE OVERVIEW //
    initBalanceOverview ()
    initAssets();
});