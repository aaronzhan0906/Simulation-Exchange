import { formatLocalTime, formatLocalTimeOnly } from "../utils/timeUtil.js";
import { checkLoginStatus } from "../utils/auth.js";
import tooltipHandler from "./tooltipHandler.js";
import tradeWebSocket from "../services/tradeWS.js";


let lastPrice = null;
let isPriceSet = false;
// let isOrderUpdateListening = false;
const pair = location.pathname.split("/")[2];
const baseAsset = pair.split("_")[0];

// precision
let currentPricePrecision = 2;
let currentQuantityPrecision = 2;

function getPricePrecision(price) {
    const decimalPart = price.toString().split(".")[1];
    if (!decimalPart) return 2;
    return decimalPart.length;
}

// if 1 < price < 10, quantity precision = 1 and so on
function getQuantityPrecision(price) { 
    const integerPart = Math.floor(price);
    if (integerPart === 0) {
        return 5; // if price < 1, quantity precision = 5
    }
    return Math.max(Math.floor(Math.log10(integerPart))+1, 0);
}



///////////////////////////////// INITIALIZATION ////////////////////////////////////
// get websocket data
async function initTradePanelWebSocket(){
    // get recent price by API first
    const response = await fetch(`/api/quote/ticker/${pair}`);
    const responseData = await response.json();
    if (response.ok){
        handlePriceUpdate({ detail: responseData.data });
    }

    // get order book by API first
    const orderBookResponse = await fetch(`/api/quote/orderBook/${pair}`);
    const responseOrderBookData = await orderBookResponse.json();
    const orderBookData = responseOrderBookData.data;
    if (orderBookResponse.ok){
        handleOrderBookUpdate({ detail: orderBookData });
    } 
    
    document.addEventListener("recentPrice", handlePriceUpdate);
    document.addEventListener("orderBook", handleOrderBookUpdate);

    const submitBtn = document.getElementById("trade-panel__submit");
    const isLoggedIn = checkLoginStatus();
    if (!isLoggedIn) {
        submitBtn.classList.remove("buy");
        submitBtn.classList.add("buyUnauthorized");
        submitBtn.disabled = true;
    }

    const tradePanelAsset = document.getElementById("trade-panel__currency");
    tradePanelAsset.textContent = `${baseAsset.toUpperCase()}`;
    submitBtn.textContent = `Buy ${baseAsset.toUpperCase()}`;
}

async function listenForOrderUpdate(){
    document.addEventListener("orderUpdate", handleOrderUpdate);
}

async function listenForRecentTrade(){
    // order book spread in handlePriceUpdate
    document.addEventListener("recentTrade", handlePriceUpdate);
    // recent trade
    document.addEventListener("recentTrade", handleRecentTrade);
}


// init order book
function initOrderBook () {
    const tableHeader = document.getElementById("order-book__table-header");
    const priceSpan = document.createElement("span");
    priceSpan.textContent = `Price(USDT)`;
    tableHeader.appendChild(priceSpan);

    const qtySpan = document.createElement("span");
    qtySpan.textContent = `Qty(${baseAsset.toUpperCase()})`;
    tableHeader.appendChild(qtySpan);
}   



//////////////////////////// TRADE PANEL ////////////////////////////
// get available balance in TRADE PANEL
async function initAvailableBalance () {
    const isLoggedIn = checkLoginStatus();
    const unAuthPrice = document.getElementById("trade-panel__available-price");
    unAuthPrice.textContent = "- USDT";
    if (!isLoggedIn) return;

    const availablePrice = document.getElementById("trade-panel__available-price");
    const response = await fetch("/api/wallet/available");
        
    if (response.ok){
        const data = await response.json();
        const globalAvailablePrice = new Decimal(data.available || 0); // if no balance, return 0
        availablePrice.textContent = `${globalAvailablePrice.toFixed(2)} USDT`;
    }
}



//get available asset in TRADE PANEL
async function initAvailableAsset(){
    const isLoggedIn = checkLoginStatus();
    const unAuthAsset = document.getElementById("trade-panel__available-asset");
    unAuthAsset.textContent = `- ${baseAsset.toUpperCase()}`;
    if (!isLoggedIn) return;

    const availableAsset = document.getElementById("trade-panel__available-asset");
    const response = await fetch(`/api/wallet/asset/${baseAsset}`);
    
    if (response.ok){
        const data = await response.json();
        const availableAmount = new Decimal(data.amount.available_quantity || 0); // if no asset, return 0
        availableAsset.textContent = `${availableAmount.toFixed(5)} ${baseAsset.toUpperCase()}`;
    }

}

// create order by TRADE PANEL 
async function submitOrder(orderType, orderSide, price, quantity) { 
    const isLoggedIn = checkLoginStatus();

    if (!isLoggedIn) {
        alert("Please login first");
        return;
    };

    if (price == 0) {
        // const inputPrice = document.getElementById("trade-panel__input--price");
        const inputTotal = document.getElementById("trade-panel__input--total");
        // tooltipHandler.show(inputPrice, "Price cannot be 0", top);
        tooltipHandler.show(inputTotal, "Total cannot be 0", top);
        return;
    }

    if (quantity == 0) {
        const inputQuantity = document.getElementById("trade-panel__input--quantity");
        const minQuantity = 1 / Math.pow(10, currentQuantityPrecision);
        tooltipHandler.show(inputQuantity, `Min Quantity: ${minQuantity} ${baseAsset}`, top);
        return;
    }

    tooltipHandler.hide();

    try {
        const response = await fetch("/api/trade/order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                symbol: `${baseAsset}_usdt`,
                side: orderSide,
                type: orderType,
                price: new Decimal(price).toFixed(currentPricePrecision),
                quantity: new Decimal(quantity).toFixed(currentQuantityPrecision),
            }),
        });

        if (response.ok) {
            initAvailableBalance();
            initAvailableAsset();
        } else {
            throw new Error(response.status);
        }
    } catch (error) {
        console.error("Order creation Fail:", error);
        throw error;
    }
}

// decide this order is buy or sell
async function setupOrder(){
    const submitButton = document.getElementById("trade-panel__submit");
    const priceInput = document.getElementById("trade-panel__input--price");
    const quantityInput = document.getElementById("trade-panel__input--quantity");
    const orderTypeSelect = document.getElementById("trade-panel__type");
   

    submitButton.addEventListener("click", async () => {
        const orderType = orderTypeSelect.value;
        const orderSide = submitButton.classList.contains("buy") ? "buy" : "sell";
        const price = priceInput.value;
        const quantity = quantityInput.value;

        try {
            await submitOrder(orderType, orderSide, price, quantity);
        } catch (error) {
            console.error("Fail to submit order in setupOrder():", error);
        }
    });
}


// buy and sell mode status
function initTabsAndSubmit() {
    const isLoggedIn = checkLoginStatus();

    const buyButton = document.getElementById("trade-panel__tab--buy");
    const sellButton = document.getElementById("trade-panel__tab--sell");
    const submitButton = document.getElementById("trade-panel__submit");
    const availablePrice = document.getElementById("trade-panel__available-price");
    const availableAsset = document.getElementById("trade-panel__available-asset");

    function updateDisplayAvailable(isBuyMode){
        availablePrice.style.display = isBuyMode ? "block" : "none";
        availableAsset.style.display = isBuyMode ? "none" : "block";
    } 

    // init
    buyButton.classList.add("active");
    sellButton.classList.remove("active");
    submitButton.classList.add("buy")
    updateDisplayAvailable(true);

    if (isLoggedIn) {
        submitButton.classList.add("buy");
    } else {
        submitButton.classList.add("buyUnauthorized");
    }
    
    // status change
    buyButton.addEventListener("click", () => {
        buyButton.classList.add("active");
        sellButton.classList.remove("active");
        submitButton.classList.add("buy");
        submitButton.classList.remove("sell");
        submitButton.textContent = `Buy ${baseAsset.toUpperCase()}`;
        
        if (isLoggedIn) {
            submitButton.classList.add("buy");
            submitButton.classList.remove("buyUnauthorized", "sell", "sellUnauthorized");
        } else {
            submitButton.classList.add("buyUnauthorized");
            submitButton.classList.remove("buy", "sell", "sellUnauthorized");
        }
        updateDisplayAvailable(true);
    });
    
    sellButton.addEventListener("click", () => {
        sellButton.classList.add("active");
        buyButton.classList.remove("active");
        submitButton.classList.add("sell");
        submitButton.classList.remove("buy");
        submitButton.textContent = `Sell ${baseAsset.toUpperCase()}`;        
        if (isLoggedIn) {
            submitButton.classList.add("sell");
            submitButton.classList.remove("sellUnauthorized", "buy", "buyUnauthorized");
        } else {
            submitButton.classList.add("sellUnauthorized");
            submitButton.classList.remove("sell", "buy", "buyUnauthorized");
        }
        updateDisplayAvailable(false);
    });
}

// quick select button and input handler in TRADE PANEL
function quickSelectButtonAndInputHandler() {
    const buttons = document.querySelectorAll(".trade-panel__quick-select button");
    const availablePriceElement = document.getElementById("trade-panel__available-price");
    const availableAssetElement = document.getElementById("trade-panel__available-asset");
    const priceInput = document.getElementById("trade-panel__input--price");
    const quantityInput = document.getElementById("trade-panel__input--quantity");
    const totalInput = document.getElementById("trade-panel__input--total");
    const inputs = [priceInput, quantityInput, totalInput];
    const buyButton = document.getElementById("trade-panel__tab--buy");
    const sellButton = document.getElementById("trade-panel__tab--sell");
    const submitButton = document.getElementById("trade-panel__submit");

    // re evaluate current mode
    buyButton.addEventListener("click", reevaluateSubmitButtonState);
    sellButton.addEventListener("click", reevaluateSubmitButtonState);

    function reevaluateSubmitButtonState() {
        updateMode();
        const isBuyMode = currentMode === "buy";
        const price = new Decimal(priceInput.value || "0");
        const quantity = new Decimal(quantityInput.value || "0");
        const total = price.times(quantity);
    
        checkAvailableAmount(isBuyMode ? total : quantity);
    }

    let currentMode = "buy";
    function updateMode() {
        currentMode = buyButton.classList.contains("active") ? "buy" : "sell";
    }

    function clearActiveButtons() {
        buttons.forEach(btn => btn.classList.remove("active"));
    }

    // restrict input to positive numbers with specified decimal places
    function restrictPositiveNum(inputValue, decimalPlaces) {
        const reg = new RegExp(`^\\d*(\\.\\d{0,${decimalPlaces}})?$`);
        return reg.test(inputValue) ? inputValue : inputValue.slice(0, -1);
    }

    function checkLeastQuantity(quantity) {
        const minQuantity = 1 / Math.pow(10, currentQuantityPrecision);
        return new Decimal(quantity).lessThan(minQuantity);
    }

    function checkAvailableAmount(amount) {
        const isBuyMode = currentMode === "buy";
        const availableAmount = isBuyMode
            ? new Decimal(availablePriceElement.textContent.replace(" USDT", "") || "0")
            : new Decimal(availableAssetElement.textContent.replace(` ${baseAsset.toUpperCase()}`, "") || "0");
        
        let isDisabled = false;
        let tooltipMessage = "";
        let tooltipTarget = isBuyMode ? totalInput : quantityInput;

        if (amount.isZero() && inputType !== "quantity") {
            return true; 
        }
    
        if (availableAmount.isZero()) {
            isDisabled = true;
            tooltipTarget = isBuyMode
                ? availablePriceElement
                : availableAssetElement;
            tooltipMessage = isBuyMode
                ? "Insufficient balance"
                : "Insufficient asset";
        } else if (amount.greaterThan(availableAmount)) {
            console.log(availableAmount);
            isDisabled = true;
            tooltipMessage = isBuyMode
                ? `Max Amount ${availableAmount.toFixed(2)} USDT`
                : `Max Quantity ${availableAmount.toFixed(5)} ${baseAsset.toUpperCase()}`;
        } else if (checkLeastQuantity(quantityInput.value)) {
            isDisabled = true;
            tooltipMessage = `Min Quantity: ${(1 / Math.pow(10, currentQuantityPrecision)).toFixed(currentQuantityPrecision)} ${baseAsset.toUpperCase()}`;
            tooltipTarget = quantityInput;
        }
    
        if (isDisabled) {
            tooltipHandler.show(tooltipTarget, tooltipMessage, "top");
            submitButton.disabled = true;
        } else {
            tooltipHandler.hide();
            submitButton.disabled = false;
        }
    
        submitButton.removeEventListener("mouseover", showButtonTooltip);
        submitButton.removeEventListener("mouseout", hideButtonTooltip);
    
        if (isDisabled) {
            submitButton.addEventListener("mouseover", showButtonTooltip);
            submitButton.addEventListener("mouseout", hideButtonTooltip);
        }
    
        return true;  // keep calculation
    }
    
    function showButtonTooltip() {
        updateMode(); 
        const isBuyMode = currentMode === "buy";
        let availableAmount, tooltipMessage, tooltipTarget;
    
        if (isBuyMode) {
            availableAmount = new Decimal(availablePriceElement.textContent.replace(" USDT", "") || "0");
            tooltipTarget = totalInput;
            tooltipMessage = availableAmount.isZero() ? "Insufficient balance" : `Max Amount ${availableAmount.toFixed(2)} USDT`;
        } else {
            availableAmount = new Decimal(availableAssetElement.textContent.replace(` ${baseAsset.toUpperCase()}`, "") || "0");
            tooltipTarget = availableAssetElement;
            tooltipMessage = availableAmount.isZero() ? "Insufficient Asset" : `Max Quantity ${availableAmount.toFixed(5)} ${baseAsset.toUpperCase()}`;
        }
    
        tooltipHandler.show(tooltipTarget, tooltipMessage, "top");
    }
    
    function hideButtonTooltip() {
        tooltipHandler.hide();
    }

    // CALCULATE AND UPDATE
    function calculateAndUpdate(changedInput) {
        const price = new Decimal(priceInput.value || "0");
        const quantity = new Decimal(quantityInput.value || "0");
        const total = new Decimal(totalInput.value || "0");
        const isBuyMode = buyButton.classList.contains("active");
              
        if (changedInput === "price" || changedInput === "quantity") {
            const calculatedTotal = price.times(quantity);
            if (checkAvailableAmount(isBuyMode ? calculatedTotal : quantity, changedInput)) {
                totalInput.value = calculatedTotal.toFixed(2);
            }
        } else if (changedInput === "total") {
            if (price.isZero()) {
                quantityInput.value = "0";
            } else {
                const calculatedQuantity = total.div(price);
                quantityInput.value = calculatedQuantity.toFixed(currentQuantityPrecision);
            }
            
            if (!checkAvailableAmount(isBuyMode ? total : new Decimal(quantityInput.value), changedInput)) {
            }
        }
    }

    // Percentage button click handler
    buttons.forEach(button => {
        button.addEventListener("click", function() {
            clearActiveButtons();
            this.classList.add("active");

            const availablePrice = new Decimal(availablePriceElement.textContent.replace(" USDT", "") || "0" );
            const availableAsset = new Decimal(availableAssetElement.textContent.replace(` ${baseAsset.toUpperCase()}`, "") || "0");
            const currentPrice = new Decimal(priceInput.value || "0");
            const dataValue = new Decimal(this.dataset.value); // 0.25, 0.5, 0.75, 1

            const isBuyMode = buyButton.classList.contains("active");

            if (isBuyMode) {
                const totalAmount = availablePrice.times(dataValue);
                const quantity = currentPrice.isZero() ? new Decimal(0) : totalAmount.dividedBy(currentPrice);
                quantityInput.value = quantity.toFixed(currentQuantityPrecision);
                totalInput.value = totalAmount.toFixed(2);
            } else {
                const quantity = availableAsset.times(dataValue);
                const totalAmount = quantity.times(currentPrice);
                quantityInput.value = quantity.toFixed(currentQuantityPrecision);
                totalInput.value = totalAmount.toFixed(2);
            }
        });
    });

    // Input event handling
    inputs.forEach(input => {
        input.addEventListener("focus", (event) => {
            clearActiveButtons(); // clear active percentage buttons
        });

        input.addEventListener("blur", () => {
            tooltipHandler.hide();
        });

        input.addEventListener("keydown", function(event) { // Prevent arrow keys from changing input value
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
            }
        });

        input.addEventListener("input", (event) => {
            const inputId = event.target.id;
            const inputType = inputId.split("--")[1]; // price, quantity, or total
            const inputValue = event.target.value;
            
            // Apply appropriate restrictions based on input type
            if (inputType === "price") {
                event.target.value = restrictPositiveNum(inputValue, currentPricePrecision);
            } else if (inputType === "quantity") {
                event.target.value = restrictPositiveNum(inputValue, currentQuantityPrecision);
            } else {
                event.target.value = restrictPositiveNum(inputValue, 2); // only (0.XX) for total
            }
            
            calculateAndUpdate(inputType);
        });
    });
}



//////////////////////////// OPEN ORDERS ////////////////////////////
// get open orders
async function getOpenOrders(){
    const isLoggedIn = checkLoginStatus();
    if (!isLoggedIn) return;

    try {
        const response = await fetch("/api/trade/order")
        const data = await response.json();
        if (response.ok){
            data.orders.forEach(order => {
                addOrderToUI(order);
            })
        }
        tradeWebSocket.requestPersonalData(); // for personal room
        listenForOrderUpdate(); 
    } catch (error) {
        console.error("[getOpenOrders] error", error);
        throw error;
    }
}

async function historyBtnHandler(){
    const historyBtn = document.getElementById("open-orders__history-btn");
    historyBtn.addEventListener("click", async () => {
        window.location.href = "/history";
    });
}


// OPEN ORDERS // add order to UI
function addOrderToUI(orderData) {
    const tbody = document.getElementById("open-orders__tbody");
    const newRow = document.createElement("tr");
    newRow.className = "open-orders__tr";
    newRow.setAttribute("order-id", orderData.orderId);

    const [base, quoteCurrency] = orderData.symbol.toUpperCase().split("_");
    
    const cells = [
        formatLocalTime(orderData.createdAt),
        `${base}/${quoteCurrency}`,
        orderData.type.charAt(0).toUpperCase() + orderData.type.slice(1),
        orderData.side.charAt(0).toUpperCase() + orderData.side.slice(1),
        `${new Decimal(orderData.price).toFixed(2)} ${quoteCurrency}`,
        `${new Decimal(orderData.quantity).toFixed(5)} ${base}`,
        handlePartiallyFilled(orderData.executedQuantity, base),
        handleStatusName(orderData.status),
        "Cancel"
    ];

    cells.forEach((cellData, index) => {
        const td = document.createElement("td");
        td.className = "open-orders__td";
        if (index === cells.length - 1) {
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = cellData;
            cancelBtn.className = "cancel-btn";
            cancelBtn.addEventListener("click", async () => {
                try {
                    await cancelOrder(orderData.orderId);
                } catch (error) {
                    console.error("Failed to cancel order:", error);
                }
            });
            td.appendChild(cancelBtn);
        } else {
            td.textContent = cellData;
        }

        // buy and sell color
        if (index === 3) {
            td.classList.add(orderData.side === "buy" ? "open-orders__cell--buy" : "open-orders__cell--sell");
        }

        newRow.appendChild(td);
    });

    if (tbody.firstChild) {
        tbody.insertBefore(newRow, tbody.firstChild);
    } else {
        tbody.appendChild(newRow);
    }


    updateOpenOrdersCount();
}

// handle filled display
function handlePartiallyFilled(executedQuantity, base) {
    if (executedQuantity === "0.00000000") {
        return `- ${base}`;
    } else {
        return `${new Decimal(executedQuantity).toFixed(5)} ${base}`;  // Added return statement
    }
}
 

// change status name
function handleStatusName(status){
    switch (status){
        case "filled":
            return "Filled";
        case "partially_filled":
            return "Partially Filled";
        case "open":
            return "Open";
        default:
            return status;
    }
}

// OPEN ORDERS // update status
async function handleOrderUpdate(event) {
    console.log(event.detail);
    if (event.detail.status === "open") {
        addOrderToUI(event.detail);
    }

    const orderData = event.detail;
    const orderRow = document.querySelector(`[order-id="${orderData.orderId}"]`);
    if (!orderRow) return;

    const cells = orderRow.getElementsByTagName("td");
    const symbol = cells[1].textContent.split("/")[0];
    const cancelBtn = orderRow.children[8].querySelector("button");
    const filledQuantityCell = cells[6];
    const statusCell = cells[7];

    // for different page cancel order (trade / history)
    try {
        if (orderData.status === "CANCELED" || orderData.status === "PARTIALLY_FILLED_CANCELED") {
            orderRow.remove();
        } else {
            if (orderData.status === "filled") {
                if (cancelBtn) {
                    cancelBtn.remove();
                }
                orderRow.remove();
            }

            if (orderData.filledQuantity !== undefined) {
                const dFilledQty = new Decimal(orderData.filledQuantity).toFixed(5);
                filledQuantityCell.textContent = `${dFilledQty} ${symbol}`;
            }

            statusCell.textContent = handleStatusName(orderData.status); // 這邊
        }

        updateOpenOrdersCount();

    } catch (error) {
        console.error("Failed to handle order update:", error);
    }
}

// OPEN ORDERS // handle cancel order 
async function cancelOrder(orderId) {
    const orderRow = document.querySelector(`[order-id="${orderId}"]`);
    const symbol = orderRow.children[1].textContent.split("/")[0];
    const symbolPair = symbol.toLowerCase() + "_usdt"; // ABC -> abc_usdt

    try {
        const response = await fetch("/api/trade/order",{
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                orderId: orderId,
                symbol: symbolPair,
            })
        })

        if (response.ok){
            orderRow.remove();
            updateOpenOrdersCount();
            initAvailableBalance();
            initAvailableAsset();
        } else if (response.status === 401) {
            orderRow.remove();
            console.log("Order already filled");
        } else {
            console.error("Fail to cancel order in cancelOrder():", response.error);
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("Fail to cancel order in cancelOrder():", error);
        throw error;
    }
}

function updateAvailableBalanceAfterCancel() {

}

// OPEN ORDERS // update open orders count 
function updateOpenOrdersCount() {
    const openOrdersCount = document.getElementById("open-orders-count");
    const cancelButtons = document.querySelectorAll(".cancel-btn");
    openOrdersCount.textContent = `Open orders(${cancelButtons.length})`;
}

// ORDER BOOK // 
function handleOrderBookUpdate(event){
    const orderBook = event.detail;
    const asksSide = document.getElementById("order-book__asks");
    updateOrderBookContent(asksSide, orderBook.asks, true);  

    const bidsSide = document.getElementById("order-book__bids");
    updateOrderBookContent(bidsSide, orderBook.bids, false);  
}

// ORDER BOOK //
function updateOrderBookContent(element, orders, isAsk = false) {
    // Clear all child nodes
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }

    orders.forEach(order => {
        const [price, total] = order;
        const itemDiv = document.createElement("div");
        itemDiv.className = isAsk ? "asks__item" : "bids__item";

        const priceSpan = document.createElement("span");
        const totalSpan = document.createElement("span");

        priceSpan.textContent = price;
        totalSpan.textContent = total;  

        itemDiv.appendChild(priceSpan);
        itemDiv.appendChild(totalSpan);

        element.appendChild(itemDiv);
    });
}


// update  ORDER BOOK PRICE and HEADER price
function handlePriceUpdate(event) { 
    const currentPrice = new Decimal(event.detail.price);
    currentPricePrecision = getPricePrecision(currentPrice);
    currentQuantityPrecision = getQuantityPrecision(currentPrice); // get quantity precision

    const headerPrice = document.getElementById("chart-header__price");
    const priceElement = document.getElementById("order-book__price");

    const quantityInput = document.getElementById("trade-panel__input--quantity");
    if (quantityInput) {
        quantityInput.step = `1e-${currentQuantityPrecision}`;
        quantityInput.setAttribute('data-precision', currentQuantityPrecision);
    }

    if (headerPrice) {
        headerPrice.textContent = currentPrice.toFixed(currentPricePrecision);
    }

    if (priceElement) {
        priceElement.textContent = currentPrice.toFixed(currentPricePrecision);
        

        if (lastPrice !== null) {
            if (currentPrice.greaterThan(lastPrice)) {
                priceElement.classList.remove("negative");
                priceElement.classList.add("positive");
            } else if (currentPrice.lessThan(lastPrice)) {
                priceElement.classList.remove("positive");
                priceElement.classList.add("negative");
            } else {
                priceElement.classList.remove("positive");
                priceElement.classList.remove("negative");
            }
        }
        lastPrice = currentPrice;
    }

    

    const priceUsdElement = document.getElementById("order-book__price--usd");
    if (priceUsdElement) {
        priceUsdElement.textContent = `≈${currentPrice.toFixed(currentPricePrecision)} USD`;
    }

    const headerPriceUsdElement = document.getElementById("chart-header__price--usd");
    if (headerPriceUsdElement) {
        headerPriceUsdElement.textContent = `≈${currentPrice.toFixed(currentPricePrecision)} USD`;
    }

    // set price only once
    if (!isPriceSet){
        const inputPrice = document.getElementById("trade-panel__input--price");
        if (inputPrice) {
            inputPrice.value = currentPrice.toFixed(currentPricePrecision);
            isPriceSet = true;
        }
    }
}



//////////////////////////// RECENT TRADES ////////////////////////////
function handleRecentTrade(event) {
    const recentTradeData = event.detail;
    const tradesList = document.getElementById("recent-trades__list");
    const tradeItem = document.createElement("div");
    tradeItem.className = `recent-trade__item ${recentTradeData.side}`;

    // recent trade
    const tradeDetails = [
        { classList: "trade-price", content: Decimal(recentTradeData.price).toFixed(2) },
        { classList: "trade-time", content: formatLocalTimeOnly(recentTradeData.timestamp) }
    ];
    
    tradeDetails.forEach(detail => {
        const recentTradeDiv = document.createElement("div");
        recentTradeDiv.className = detail.class;
        recentTradeDiv.textContent = detail.content;
        tradeItem.appendChild(recentTradeDiv);
    });
    
    tradesList.insertBefore(tradeItem, tradesList.firstChild);


    const maxTrades = 25;
    while (tradesList.children.length > maxTrades) {
        tradesList.removeChild(tradesList.lastChild);
    }
}


export async function initTradePanel() {
    // init
    initOrderBook ();
    initTradePanelWebSocket();
    initTabsAndSubmit(); 
    getOpenOrders();
    await initAvailableBalance();
    await initAvailableAsset();
    quickSelectButtonAndInputHandler();
    listenForRecentTrade();
    tooltipHandler.init();

    // event listener
    setupOrder();
    historyBtnHandler()
}