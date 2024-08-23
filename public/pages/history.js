import { initializeHeader } from "../components/headerUI.js";
import { formatLocalTime } from "../utils/timeUtil.js";
import { checkLoginStatus } from "../utils/auth.js";

const API_ENDPOINTS = {
    openOrders: "/api/trade/order", // absolute path
    orderHistory: "api/history/orders",
    symbols: "api/history/symbols",
}

let isOrderUpdateListening = false;


// TAB //////////////////////////////////////////////////////////////////////////////////////////
async function initTabActive(){
    const tabsContainer = document.getElementById("history-tab__tabs");
    tabsContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if(target.classList.contains("history-tab__tab")){
            setActiveTab(target);
            const tabId = target.id;
            const table = document.getElementById("history__table");
            switch(tabId){
                case "open-orders":
                    getOpenOrders();
                    break;
                case "order-history":
                    const orderHistory = await fetch(API_ENDPOINTS.orderHistory);
                    const orderHistoryJson = await orderHistory.json();
                    renderOrderHistoryTable(orderHistoryJson, table);
                    break;
            }
        }
    });
}

function setActiveTab(activeTab) {
    const tabs = document.querySelectorAll(".history-tab__tab");
    tabs.forEach(tab => {tab.classList.remove("active")});
    activeTab.classList.add("active");
}

async function getOpenOrders(){
    const isLoggedIn = checkLoginStatus();
    if (!isLoggedIn) return;

    try {
        const [orderResponse, symbolResponse] = await Promise.all([
            fetch(API_ENDPOINTS.openOrders),
            fetch(API_ENDPOINTS.symbols)
        ]);

        const orderData = await orderResponse.json();
        const symbolData = await symbolResponse.json();

        if (orderResponse.ok && symbolResponse.ok) {
            const symbolNames = symbolData.data.map(item => item.symbolName);
            generatePairOptions(symbolNames);

            const table = document.getElementById("history__table");
            renderOpenOrdersTable(orderData, table);
            if (orderData.orders.length > 0) {
                startListeningForOrderUpdate();
            }
        }
    } catch (error) {
        console.error("Fail to get open orders or symbols:", error);
        throw error;
    }
}

// FILTERS //////////////////////////////////////////////////////////////////////////////////////////
async function fetchSymbols(){
    try {
        const response = await fetch(API_ENDPOINTS.symbols)
        const responseData = await response.json();

        if (response.ok) {
            const symbolNames = responseData.data.map(item => item.symbolName);
            generatePairOptions(symbolNames );
        }
    } catch (error) {
        console.error("Fail to get symbols:", error);
        throw error;
    }
}

function generatePairOptions(symbols) {
    const filtersContainer = document.getElementById("order-history__container");
    filtersContainer.innerHTML = "";

    const pairOptions = ["All", ...symbols.map(symbol => `${symbol.toUpperCase()}/USDT`)];   
    const pairSelect = createCustomSelect("Pair", pairOptions);     
    filtersContainer.appendChild(pairSelect);

    const orderSides = ["All", "Buy", "Sell"];
    const sideSelect = createCustomSelect("Side", orderSides);
    filtersContainer.appendChild(sideSelect);

    // Add event listener to filter table
    pairSelect.querySelector("select").addEventListener("change", filterTable);
    sideSelect.querySelector("select").addEventListener("change", filterTable);

    filterTable();
}

function createCustomSelect(label, options) {
    const customSelect = document.createElement("div");
    customSelect.className = "custom-select";

    const select = document.createElement("select");
    select.className = "filter-select";
    select.setAttribute("data-filter", label);

    // Create default option as "ALL"
    const defaultOption = document.createElement("option");
    defaultOption.textContent = label;
    defaultOption.value = "All";
    defaultOption.hidden = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.textContent = option;
        optionElement.value = option.toLowerCase();
        select.appendChild(optionElement);
    });

    customSelect.appendChild(select);
    return customSelect;
}

function filterTable() {
    const pairFilter = document.querySelector('.filter-select[data-filter="Pair"]').value;
    const sideFilter = document.querySelector('.filter-select[data-filter="Side"]').value;

    const rows = document.querySelectorAll("#open-orders__tbody tr");
    rows.forEach(row => {
        const pair = row.children[1].textContent.toLowerCase();
        const side = row.children[3].textContent.toLowerCase();

        const pairMatch = pairFilter === "All" || pair === pairFilter.toLowerCase();
        const sideMatch = sideFilter === "All" || side === sideFilter.toLowerCase();

        if (pairMatch && sideMatch) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });

}


// OPEN ORDERS //////////////////////////////////////////////////////////////////////////////////////
function renderOpenOrdersTable(openOrdersData, table){
    table.innerHTML = "";

    const isLoggedIn = checkLoginStatus();
    if(!isLoggedIn){
        return;
    }
    // create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Time", "Pair", "Type", "Side", "Price", "Quantity", "Filled", "Status", "Cancel"];
    headers.forEach(headerText => {
        const th = document.createElement("th");
        th.textContent = headerText;
        headerRow.appendChild(th);
    })
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // create table body
    const tbody = document.createElement("tbody");
    tbody.id = "open-orders__tbody";
    table.appendChild(tbody);
    openOrdersData.orders.forEach(order => {
        addOpenOrderRow(order);
    })

}

function addOpenOrderRow(orderData) {
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

        // Add buy/sell color
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
}

// OPEN ORDERS // WS 等等跟 trade 的那頁 一起用
function startListeningForOrderUpdate() {
    if (!isOrderUpdateListening) {
        document.addEventListener("orderUpdate", handleOrderUpdate);
        isOrderUpdateListening = true;
    }
}

async function handleOrderUpdate(event){
    const orderData = event.detail;
    const orderRow = document.querySelector(`[order-id="${orderData.orderId}"]`);
    if (!orderRow) return;
    
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
        }
    } catch (error) {
        console.error("Fail to handle order update in handleOrderUpdate():", error);
        throw error;
    }
}

async function cancelOrder(orderId) {
    const orderRow = document.querySelector(`[order-id="${orderId}"]`);
    const symbol = orderRow.children[1].textContent.split("/")[0];
    const symbolPair = symbol.toLowerCase() + "_usdt";

    try {
        const response = await fetch("/api/trade/order", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                orderId: orderId,
                symbol: symbolPair,
            })
        });

        if (response.ok) {
            orderRow.remove();
        } else if (response.status === 401) {
            orderRow.remove();
            console.log("Order already filled");
        } else {
            console.error("Fail to cancel order in cancelOrder():", response.statusText);
            throw new Error(response.statusText);
        }
    } catch (error) {
        console.error("Fail to cancel order in cancelOrder():", error);
        throw error;
    }
}

// 這裡需要實現 renderTradeHistoryTable 和 renderOrderHistoryTable 函數
function renderTradeHistoryTable(tradeHistoryJson, table) {
    // 實現交易歷史表格的渲染邏輯
}

function renderOrderHistoryTable(orderHistoryJson, table) {
    // 實現訂單歷史表格的渲染邏輯
}


document.addEventListener("DOMContentLoaded",async () => {
    initializeHeader();
    await initTabActive();
    await getOpenOrders();
    await fetchSymbols();
});