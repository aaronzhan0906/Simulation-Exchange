import { initializeHeader } from "../components/headerUI.js";
import { formatLocalTime } from "../utils/timeUtil.js";
import { checkLoginStatus, checkLoginStatusOnPageLoad } from "../utils/auth.js";
import HistoryWebSocket from "../services/historyWS.js";



const API_ENDPOINTS = {
    openOrders: "/api/trade/order", // absolute path
    orderHistory: "api/history/orders",
    symbols: "api/history/symbols",
}

let isOrderUpdateListening = false;
let globalSymbols = []; // for selector


///////////////////////// TAB /////////////////////////
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
                    if (globalSymbols.length !== 0) {
                        generatePairOptions(globalSymbols)
                    }
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

async function getPairs() {
    const response = await fetch(API_ENDPOINTS.symbols)
    const responseData = await response.json();

    try {
        if (responseData.ok) {
            globalSymbols = responseData.data.map(item => item.symbolName);
        }

        generatePairOptions(globalSymbols); // for selector
    } catch (error) {
        console.error("[getPairs] error", error);
    }
}

async function getOpenOrders(){
    const table = document.getElementById("history__table");

    if (!checkLoginStatus()) {
        renderOpenOrdersTable(null, table);
        return;
    } // return if not logged in

    try {
        const response = await fetch(API_ENDPOINTS.openOrders);
    
        const responseData = await response.json();
        if (responseData.ok) {
            await renderOpenOrdersTable(responseData, table);
        }

        // Listen for order updates
        if (!isOrderUpdateListening) {
            HistoryWebSocket.requestPersonalData();
            isOrderUpdateListening = true;
            document.addEventListener("orderUpdate", handleOrderUpdate);
        }
    } catch (error) {
        console.error("[getOpenOrders] error:", error);
    }
}

async function fetchOrderHistory() {
    const table = document.getElementById("history__table");

    if (!checkLoginStatus()) {
        renderOrderHistoryTable(null, table);
        return;
    }

    const timeRangeSelect = document.querySelector('.filter-select[data-filter="Time"]');
    const timeRange = timeRangeSelect ? timeRangeSelect.value : "today";

    try {
        const response = await fetch(`${API_ENDPOINTS.orderHistory}?timeRange=${timeRange}`);
        const responseData = await response.json();
        if (response.ok) {
            renderOrderHistoryTable(responseData.data, table);
            filterOrderHistoryTable(); // Apply filters again
        } else {
            console.error("Failed to fetch order history:", responseData.message);
        }
    } catch (error) {
        console.error("Error in fetchOrderHistory():", error);
    }
}

///////////////////////// FILTERS /////////////////////////

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
    pairSelect.querySelector("select").addEventListener("change", filterOpenTable);
    sideSelect.querySelector("select").addEventListener("change", filterOpenTable);

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
    if (event.detail.status === "open") {
        addOpenOrderRow(event.detail);
    }

    const orderData = event.detail;
    const orderRow = document.querySelector(`[order-id="${orderData.orderId}"]`);
    if (!orderRow) return;

    const cells = orderRow.getElementsByTagName("td");
    const symbol = cells[1].textContent.split("/")[0];
    const cancelBtn = orderRow.children[8].querySelector("button");
    const filledQuantityCell = cells[6];
    const statusCell = cells[7];


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
                orderRow.remove(); // remove, which is different from trade
            }
        }
       filterOpenTable();
    } catch (error) {
        console.error("Failed to handle order update:", error);
    }
}



// filter table
function filterOpenTable() {
    const pairFilter = document.querySelector('.filter-select[data-filter="Pair"]').value;
    const sideFilter = document.querySelector('.filter-select[data-filter="Side"]').value;

    // If filter elements don't exist yet, don't filter
    if (!pairFilter || !sideFilter) {
        console.error("Filter elements not found");
        return;
    }

    const rows = document.querySelectorAll("#open-orders__tbody tr");

    rows.forEach(row => {
        const pair = row.children[1].textContent.toLowerCase();
        const side = row.children[3].textContent.toLowerCase();

        const pairMatch = pairFilter === "all" || pair === pairFilter;
        const sideMatch = sideFilter === "all" || side === sideFilter;

        if (pairMatch && sideMatch) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
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

    const rows = document.querySelectorAll("#history__table tbody tr");

    rows.forEach(row => {
        const pair = row.children[1].textContent.toLowerCase();
        const side = row.children[3].textContent.toLowerCase();
        const status = row.children[8].textContent.toLowerCase();

        const pairMatch = pairFilter === "all" || pair === pairFilter;
        const sideMatch = sideFilter === "all" || side === sideFilter;
        const statusMatch = statusFilter === "all" 
                            || (statusFilter === "executed" 
                                && (status === "filled" || status.includes("partial"))) 
                            || (statusFilter === "canceled" && status === "canceled");


        if (pairMatch && sideMatch && statusMatch) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}


///////////////////////// OPEN ORDERS /////////////////////////
async function renderOpenOrdersTable(openOrdersData, table){
    table.innerHTML = "";

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

    if (!checkLoginStatus()) return; // If not logged in, return
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
        handlePartiallyFilled(orderData.executedQuantity, base),
        handleStatusName(orderData.status),
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

    // Only call filterOpenTable if the filters exist
    if (document.querySelector('.filter-select[data-filter="Pair"]') &&
        document.querySelector('.filter-select[data-filter="Side"]')) {
        filterOpenTable();
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

///////////////////////// ORDER HISTORY /////////////////////////
function renderOrderHistoryTable(orderHistoryData, table) {
    table.innerHTML = "";
    // console.log("orderHistoryData:", orderHistoryData);

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

    if (!checkLoginStatus()) return; // If not logged in, return

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
            handleStatusName(order.status)
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

function handlePartiallyFilled(executedQuantity, base) {
    if (executedQuantity === "0.00000000") {
        return `- ${base}`;
    } else {
        return `${new Decimal(executedQuantity).toFixed(5)} ${base}`;  // Added return statement
    }
}
 

function handleStatusName(status) {
    switch (status) {
        case "open":
            return "Open";
        case "filled":
            return "Filled";
        case "canceled":
            return "Canceled";
        case "partially_filled":
            return "Partially Filled";
        case "partially_filled_canceled":
            return "Partially Filled";
        default:
            return status;
    }
}




document.addEventListener("DOMContentLoaded",async () => {
    await checkLoginStatusOnPageLoad()
    if (checkLoginStatus()) {
        HistoryWebSocket.init();
    }
    initializeHeader();

    getPairs();

    await initTabActive();
    await getOpenOrders();
});