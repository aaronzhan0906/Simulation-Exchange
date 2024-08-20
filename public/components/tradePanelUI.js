import { formatLocalTime, formatLocalTimeOnly } from "../utils/timeUtil.js";
import { checkLoginStatus } from "../utils/auth.js";

let lastPrice = null;
let isPriceSet = false;
let isOrderUpdateListening = false;
const pair = location.pathname.split("/")[2];
const baseAsset = pair.split("_")[0];

// get websocket data
function initTradePanelWebSocket(){
    document.addEventListener("recentPrice", handlePriceUpdate);
    document.addEventListener("orderBook", handleOrderBookUpdate);


    const submitBtn = document.getElementById("trade-panel__submit");
    const isLoggedIn = checkLoginStatus();
    if (!isLoggedIn) {
        submitBtn.classList.remove("buy");
        submitBtn.classList.add("unauthorized");
        submitBtn.disabled = true;
    }

    const tradePanelAsset = document.getElementById("trade-panel__currency");
    tradePanelAsset.textContent = `${baseAsset.toUpperCase()}`;
    submitBtn.textContent = `Buy ${baseAsset.toUpperCase()}`;
}

async function startListeningForOrderUpdate(){
   if (!isOrderUpdateListening){
        document.addEventListener("orderUpdate", handleOrderUpdate);
        isOrderUpdateListening = true;
   }
}

async function listenForRecentTrade(){
    // order book spread
    document.addEventListener("recentTrade", handlePriceUpdate);
    // recent trade
    document.addEventListener("recentTrade", handleRecentTrade);
}


// ORDER BOOK //
function initOrderBook () {
    const tableHeader = document.getElementById("order-book__table-header");
    const priceSpan = document.createElement("span");
    priceSpan.textContent = `Price(USDT)`;
    tableHeader.appendChild(priceSpan);

    const qtySpan = document.createElement("span");
    qtySpan.textContent = `Qty(${baseAsset.toUpperCase()})`;
    tableHeader.appendChild(qtySpan);
}   




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
        const globalAvailablePrice = new Decimal(data.available);
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
        const availableAmount = new Decimal(data.amount.available_quantity);
        availableAsset.textContent = `${availableAmount.toFixed(5)} ${baseAsset.toUpperCase()}`;
    }

}

// get open orders in OPEN ORDERS
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
            if (data.orders.length > 0){
                startListeningForOrderUpdate();
            }
        }
    } catch (error) {
        console.error("Fail to get open orders in getOpenOrders():", error);
        throw error;
    }
}

// create order  in TRADE PANEL 
async function submitOrder(orderType, orderSide, price, quantity) {
    const isLoggedIn = checkLoginStatus();

    if (!isLoggedIn) {
        alert("Please login first");
        return;
    };

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
                price: price,
                quantity: quantity,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            addOrderToUI(data.order);
            initAvailableBalance();
            initAvailableAsset();
            startListeningForOrderUpdate();
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
    const orderTypeSelect = document.getElementById("orderTypeSelect");
   

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

// add order to OPEN ORDERS
function addOrderToUI(orderData) {
    const tbody = document.getElementById("open-orders__tbody");
    const newRow = document.createElement("tr");
    newRow.setAttribute("order-id", orderData.orderId);

    const [base, quoteCurrency] = orderData.symbol.toUpperCase().split("_");
    
    const cells = [
        formatLocalTime(orderData.createdAt),
        `${base}/${quoteCurrency}`,
        orderData.type.charAt(0).toUpperCase() + orderData.type.slice(1),
        orderData.side.charAt(0).toUpperCase() + orderData.side.slice(1),
        `${new Decimal(orderData.price).toFixed(2)} ${quoteCurrency}`,
        `${new Decimal(orderData.quantity).toFixed(5)} ${base}`,
        `- ${base}`,
        orderData.status,
        "Cancel"
    ];

    cells.forEach((cellData, index) => {
        const td = document.createElement("td");
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



// handle orders in OPEN ORDERS update status
async function handleOrderUpdate(event) {
    const orderData = event.detail;
    const orderRow = document.querySelector(`[order-id="${orderData.orderId}"]`);
    // 記得在後端處理房間問題，不然會一直有不必要的開銷
    const cells = orderRow.getElementsByTagName("td");

    const symbol = cells[1].textContent.split("/")[0];
    const cancelBtn = orderRow.children[8].children[0];
    const filledQuantityCell = orderRow.children[6];
    const statusCell = orderRow.children[7];
    try {
        filledQuantityCell.textContent = `${orderData.filledQuantity} ${symbol}`;
        statusCell.textContent = orderData.status;
        if (orderData.status === "filled") {
            cancelBtn.remove();
            updateOpenOrdersCount();
        }
    } catch (error) {
        console.error("Fail to handle order update in handleOrderUpdate():", error);
        throw error;
    }

}

// handle cancel order in OPEN ORDERS
async function cancelOrder(orderId) {
    const orderRow = document.querySelector(`[order-id="${orderId}"]`);
    const symbol = orderRow.children[1].textContent.split("/")[0];

    try {
        const response = await fetch("/api/trade/order",{
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                orderId: orderId,
                symbol: symbol,
            })
        })

        if (response.ok){
            orderRow.remove();
            updateOpenOrdersCount();
            initAvailableBalance();
            initAvailableAsset();
        } else if (response.status === 401) {
            // alert("Order already filled");
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

// update open orders count in OPEN ORDERS
function updateOpenOrdersCount() {
    const openOrdersCount = document.getElementById("open-orders-count");
    const cancelButtons = document.querySelectorAll(".cancel-btn");
    openOrdersCount.textContent = `Open orders(${cancelButtons.length})`;
}

// ORDER BOOK
function handleOrderBookUpdate(event){
    const orderBook = event.detail;
    const asksSide = document.getElementById("order-book__asks");
    updateOrderBookContent(asksSide, orderBook.asks, true);  

    const bidsSide = document.getElementById("order-book__bids");
    updateOrderBookContent(bidsSide, orderBook.bids, false);  
}

// ORDER BOOK
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

// handle RECENT TRADE
function handleRecentTrade(event) {
    const recentTradeData = event.detail;
    const tradesList = document.querySelector(".recent-trades__list");
    const tradeItem = document.createElement("div");
    tradeItem.className = `recent-trade__item ${recentTradeData.side}`;

    // Order Book spread
    

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

// update  ORDER BOOK PRICE 
function handlePriceUpdate(event) {
    // my trade(current price) for temp
    const myCurrentPrice = new Decimal(event.detail.price);

    const currentPrice = new Decimal(event.detail.price);
    const priceElement = document.getElementById("order-book__price");
    if (priceElement) {
        priceElement.textContent = currentPrice.toFixed(2);
        // my trade(current price)for temp
        priceElement.textContent = myCurrentPrice.toFixed(2);

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
        priceUsdElement.textContent = `≈${currentPrice.toFixed(2)} USD`;
    }

    // set price only once
    if (!isPriceSet){
        const inputPrice = document.getElementById("trade-panel__input--price");
        if (inputPrice) {
            inputPrice.value = currentPrice.toFixed(2);
            isPriceSet = true;
        }
    }
}

// buy and sell mode status TRADE PANEL
function initTabsAndSubmit() {
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


    // status change
    buyButton.addEventListener("click", () => {
        buyButton.classList.add("active");
        sellButton.classList.remove("active");
        submitButton.classList.add("buy");   
        submitButton.classList.remove("sell");
        submitButton.textContent = `Buy ${baseAsset.toUpperCase()}`; 
        updateDisplayAvailable(true);
    });

    sellButton.addEventListener("click", () => {
        sellButton.classList.add("active");
        buyButton.classList.remove("active");
        submitButton.classList.add("sell");
        submitButton.classList.remove("buy");
        submitButton.textContent = `Sell ${baseAsset.toUpperCase()}`; 
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

    function clearActiveButtons() {
        buttons.forEach(btn => btn.classList.remove("active"));
    }

    // restrict input to positive numbers with specified decimal places
    function restrictPositiveNum(value, decimalPlaces) {
        const reg = new RegExp(`^\\d*(\\.\\d{0,${decimalPlaces}})?$`);
        
        return reg.test(value) ? value : value.slice(0, -1);
    }

    function calculateAndUpdate(changedInput) {
        const price = new Decimal(priceInput.value || "0");
        const quantity = new Decimal(quantityInput.value || "0");
        const total = new Decimal(totalInput.value || "0");

        if (price.isZero()) return; // avoid division by zero

        if (changedInput === "price" || changedInput === "quantity") {
            totalInput.value = price.times(quantity).toFixed(2);
        } else if (changedInput === "total") {
            quantityInput.value = total.dividedBy(price).toFixed(5);
        }
    }

    // Percentage button click handler
    buttons.forEach(button => {
        button.addEventListener("click", function() {
            clearActiveButtons();
            this.classList.add("active");

            const availablePrice = new Decimal(availablePriceElement.textContent.replace(" USDT", ""));
            const availableAsset = new Decimal(availableAssetElement.textContent.replace(` ${baseAsset.toUpperCase()}`, ""));
            const currentPrice = new Decimal(priceInput.value || "0");
            const dataValue = new Decimal(this.dataset.value); // 0.25, 0.5, 0.75, 1

            const isBuyMode = buyButton.classList.contains("active");

            if (isBuyMode) {
                const totalAmount = availablePrice.times(dataValue);
                const quantity = currentPrice.isZero() ? new Decimal(0) : totalAmount.dividedBy(currentPrice);
                quantityInput.value = quantity.toFixed(5);
                totalInput.value = totalAmount.toFixed(2);
            } else {
                const quantity = availableAsset.times(dataValue);
                const totalAmount = quantity.times(currentPrice);
                quantityInput.value = quantity.toFixed(5);
                totalInput.value = totalAmount.toFixed(2);
            }
        });
    });

    // Input event handling
    inputs.forEach(input => {
        input.addEventListener("focus", clearActiveButtons);

        // Prevent arrow keys from changing input value
        input.addEventListener("keydown", function(event) {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
            }
        });

        input.addEventListener("input", (event) => {
            const inputId = event.target.id;
            const inputType = inputId.split("--")[1]; // price, quantity, or total
            
            // Apply appropriate restrictions based on input type
            if (inputType === "price") {
                event.target.value = restrictPositiveNum(event.target.value, 2);
            } else if (inputType === "quantity") {
                event.target.value = restrictPositiveNum(event.target.value, 5);
            } else {
                event.target.value = restrictPositiveNum(event.target.value, 2);
            }
            
            calculateAndUpdate(inputType);
        });
    });
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

    // event listener
    setupOrder();
}