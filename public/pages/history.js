import { initializeHeader } from "../components/headerUI.js";
import { formatLocalTime } from "../utils/timeUtil.js";
import { checkLoginStatus } from "../utils/auth.js";
import HistoryWebSocket from "../services/historyWS.js";



const API_ENDPOINTS = {
    openOrders: "/api/trade/order", // absolute path
    orderHistory: "api/history/orders",
    symbols: "api/history/symbols",
}

let isOrderUpdateListening = false;
let globalSymbols = [];


// TAB //////////////////////////////////////////////////////////////////////////////////////////
async function initTabActive(){
    const tabsContainer = document.getElementById("history-tab__tabs");
    tabsContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if(target.classList.contains("history-tab__tab")){
            setActiveTab(target);
            const tabId = target.id;
            switch(tabId){
                case "open-orders":
                    await getOpenOrders();
                    break;
                case "order-history":
                    generateOrderHistoryFilters();
                    await fetchOrderHistory();
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
            globalSymbols = symbolData.data.map(item => item.symbolName);
            generatePairOptions(globalSymbols);

            const table = document.getElementById("history__table");
            renderOpenOrdersTable(orderData, table);
            if (orderData.orders.length > 0) {
                startListeningForOrderUpdate();
                HistoryWebSocket.requestPersonalData();
            }
        }
    } catch (error) {
        console.error("Fail to get open orders or symbols:", error);
    }
}

async function fetchOrderHistory() {
    const timeRangeSelect = document.querySelector('.filter-select[data-filter="Time"]');
    const timeRange = timeRangeSelect ? timeRangeSelect.value : "today";

    try {
        const response = await fetch(`${API_ENDPOINTS.orderHistory}?timeRange=${timeRange}`);
        const responseData = await response.json();
        if (response.ok) {
            const table = document.getElementById("history__table");
            renderOrderHistoryTable(responseData.data, table);
            filterOrderHistoryTable(); // Apply filters again
        } else {
            console.error("Failed to fetch order history:", responseData.message);
        }
    } catch (error) {
        console.error("Error in fetchOrderHistory():", error);
    }
}

// FILTERS //////////////////////////////////////////////////////////////////////////////////////////

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

function createCustomSelect(label, options, defaultValue = "All", displayLabel = null) {
    const customSelect = document.createElement("div");
    customSelect.className = "custom-select";

    const select = document.createElement("select");
    select.className = "filter-select";
    select.setAttribute("data-filter", label);

    // Add a default option for non-Time selectors
    if (label !== "Time") {
        // Add a default option that displays the label name but has a value of "all"
        const defaultOption = document.createElement("option"); 
        defaultOption.textContent = label;
        defaultOption.value = "all";
        defaultOption.selected = true;
        defaultOption.hidden = true; // Hide the default option
        select.appendChild(defaultOption);

        // Modification: Add an "All" option to the list of options
        const allOption = document.createElement("option");
        allOption.textContent = "All";
        allOption.value = "all";
        select.appendChild(allOption);

        // Add other options
        options.forEach((option) => {
            if (option.toLowerCase() !== "all") {
                const optionElement = document.createElement("option");
                optionElement.textContent = option;
                optionElement.value = option.toLowerCase();
                select.appendChild(optionElement);
            }
        });
    } else {
        options.forEach((option) => {
            const optionElement = document.createElement("option");
            optionElement.textContent = option;
            optionElement.value = option.toLowerCase().replace(/ /g, "_");
            if (option.toLowerCase() === defaultValue?.toLowerCase()) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
    }

    customSelect.appendChild(select);
    return customSelect;
}


async function handleOrderUpdate(event) {
    const orderData = event.detail;
    const orderRow = document.querySelector(`[order-id="${orderData.orderId}"]`);
    if (!orderRow) return;

    const cells = orderRow.getElementsByTagName("td");
    const symbol = cells[1].textContent.split("/")[0];
    const cancelBtn = orderRow.children[8].querySelector("button");
    const filledQuantityCell = cells[6];
    const statusCell = cells[7];
    console.log("orderData:", orderData);
    try {
        if (orderData.status === "CANCELED" || orderData.status === "PARTIALLY_FILLED_CANCELED") {
            orderRow.remove();
        } else {
            if (orderData.filledQuantity !== undefined) {
                filledQuantityCell.textContent = `${orderData.filledQuantity} ${symbol}`;
            }

            statusCell.textContent = orderData.status;

            if (orderData.status === "filled") {
                if (cancelBtn) {
                    cancelBtn.remove();
                }
                orderRow.remove();
            }
        }
    } catch (error) {
        console.error("Failed to handle order update:", error);
    }
}



// filter table
function filterTable() {
    const pairFilter = document.querySelector('.filter-select[data-filter="Pair"]').value;
    const sideFilter = document.querySelector('.filter-select[data-filter="Side"]').value;

    console.log("過濾條件：", { pair: pairFilter, side: sideFilter });

    const rows = document.querySelectorAll("#open-orders__tbody tr");
    let visibleRowCount = 0;

    rows.forEach(row => {
        const pair = row.children[1].textContent.toLowerCase();
        const side = row.children[3].textContent.toLowerCase();

        const pairMatch = pairFilter === "all" || pair === pairFilter;
        const sideMatch = sideFilter === "all" || side === sideFilter;

        if (pairMatch && sideMatch) {
            row.style.display = "";
            visibleRowCount++;
        } else {
            row.style.display = "none";
        }
    });

    console.log("可見行數：", visibleRowCount);
}






// order history filter
function generateOrderHistoryFilters() {
    const filtersContainer = document.getElementById("order-history__container");
    filtersContainer.innerHTML = "";

    const timeRanges = ["Today", "Seven Days", "One Month", "All"];
    const timeRangeSelect = createCustomSelect("Time", timeRanges, "Today", "Today");
    filtersContainer.appendChild(timeRangeSelect);

    const pairOptions = ["All", ...globalSymbols.map(symbol => `${symbol.toUpperCase()}/USDT`)];
    const pairSelect = createCustomSelect("Pair", pairOptions);
    filtersContainer.appendChild(pairSelect);

    const orderSides = ["All", "Buy", "Sell"];
    const sideSelect = createCustomSelect("Side", orderSides);
    filtersContainer.appendChild(sideSelect);

    const statusOptions = ["All", "Executed", "Canceled"];
    const statusSelect = createCustomSelect("Status", statusOptions);
    filtersContainer.appendChild(statusSelect);

    pairSelect.querySelector("select").addEventListener("change", filterOrderHistoryTable);
    sideSelect.querySelector("select").addEventListener("change", filterOrderHistoryTable);
    statusSelect.querySelector("select").addEventListener("change", filterOrderHistoryTable);
    // fetchOrderHistory() by time range
    timeRangeSelect.querySelector("select").addEventListener("change", async (event) => {
        await fetchOrderHistory();
    });
}

function filterOrderHistoryTable(event) {
    if (event && event.target.getAttribute("data-filter") === "Time") {
        return;
    }

    const pairFilter = document.querySelector('.filter-select[data-filter="Pair"]').value;
    const sideFilter = document.querySelector('.filter-select[data-filter="Side"]').value;
    const statusFilter = document.querySelector('.filter-select[data-filter="Status"]').value;

    console.log("過濾條件：", { pair: pairFilter, side: sideFilter, status: statusFilter });

    const rows = document.querySelectorAll("#history__table tbody tr");
    let visibleRowCount = 0;

    rows.forEach(row => {
        const pair = row.children[1].textContent.toLowerCase();
        const side = row.children[3].textContent.toLowerCase();
        const status = row.children[8].textContent.toLowerCase();

        const pairMatch = pairFilter === "all" || pair === pairFilter;
        const sideMatch = sideFilter === "all" || side === sideFilter;
        const statusMatch = statusFilter === "all" 
                            || (statusFilter === "executed" 
                            && (status === "filled" || status === "partially_filled" || status === "partially_filled_canceled")) 
                            || (statusFilter === "canceled" && status === "canceled");

        if (pairMatch && sideMatch && statusMatch) {
            row.style.display = "";
            visibleRowCount++;
        } else {
            row.style.display = "none";
        }
    });

    console.log("可見行數：", visibleRowCount);
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

function startListeningForOrderUpdate() {
    if (!isOrderUpdateListening) {
        document.addEventListener("orderUpdate", handleOrderUpdate);
        isOrderUpdateListening = true;
        HistoryWebSocket.requestPersonalData();
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

// ORDER HISTORY //////////////////////////////////////////////////////////////////////////////////////
function renderOrderHistoryTable(orderHistoryData, table) {
    table.innerHTML = "";
    console.log("orderHistoryData:", orderHistoryData);
    const isLoggedIn = checkLoginStatus();
    if(!isLoggedIn){
        return;
    }

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Time", "Pair", "Type", "Side", "Price", "Quantity", "Filled", "Avg Price", "Status"];
    headers.forEach(headerText => {
        const th = document.createElement("th");
        th.textContent = headerText;
        headerRow.appendChild(th);
    })
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    orderHistoryData.forEach(order => {
        const row = document.createElement("tr");
        const [base, quoteCurrency] = order.symbol.toUpperCase().split("_");

        const cells = [
            formatLocalTime(order.time),
            `${base}/${quoteCurrency}`,
            order.type.charAt(0).toUpperCase() + order.type.slice(1),
            order.side.charAt(0).toUpperCase() + order.side.slice(1),
            `${new Decimal(order.price).toFixed(2) || 0} ${quoteCurrency}`,
            `${new Decimal(order.quantity).toFixed(5) || 0} ${base}`,
            `${new Decimal(order.filled).toFixed(5) || 0} ${base}`,
            order.averagePrice ? `${new Decimal(order.averagePrice).toFixed(2) || 0} ${quoteCurrency}` : '-',
            order.status.charAt(0).toUpperCase() + order.status.slice(1)
        ];

        cells.forEach((cellData, index) => {
            const cell = document.createElement("td");
            cell.textContent = cellData;
            if (index === 3) { 
                cell.classList.add(order.side.toLowerCase() === "buy" ? "trade-history__cell--buy" : "trade-history__cell--sell");
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    })
    filterOrderHistoryTable();
}



document.addEventListener("DOMContentLoaded",async () => {
    initializeHeader();
    HistoryWebSocket.init();
    await initTabActive();
    await getOpenOrders();
});