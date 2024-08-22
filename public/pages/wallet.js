import { initializeHeader } from "../components/headerUI.js";
import { checkLoginStatus } from "../utils/auth.js";


document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    // BALANCE OVERVIEW //
    initBalanceOverview ()
    initAssets();
});


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

            assetItemAmount.textContent = `${balance} USDT`
            assetItemAvailable.textContent = `${available} USDT`
            balanceValueAvailable.textContent = `${available} USDT`;
            balanceValueLocked.textContent = `${locked} USDT`;
        }
    } catch (error) {
        console.error("Error in initBalanceOverview():",error);
    }
}



// MY ASSETS //
async function initAssets() {
    const assetListContainer = document.getElementById("asset-list__container");
    
    try {
        const response = await fetch("/api/wallet/assetsAndSymbols");
        const data = await response.json();

        if (response.ok && data.assets && Array.isArray(data.assets)) {
            data.assets.forEach(asset => {
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
                changeDiv.textContent = `${new Decimal(asset.change24h || 0).toFixed(2)}%`;
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
            });
        } else {
            console.error("Invalid API response:", data);
        }
    } catch (error) {
        console.error("Error in initAssets():", error);
    }
}