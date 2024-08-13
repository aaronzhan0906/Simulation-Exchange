let lastPrice = null;
let isPriceSet = false;

// get websocket recent price
function initTradePanelWebSocket(){
    document.addEventListener("recentPrice", handlePriceUpdate);
    document.addEventListener("orderBook", handleOrderBookUpdate);
}

// get available balance
async function initAvailableBalance () {
    const availablePrice = document.getElementById("trade-panel__available-price");
    

    const response = await fetch("api/wallet/available", {
        method: "GET",      
        headers: {
            "Content-Type": "application/json",
        },
    });
        
    if (response.ok){
        const data = await response.json();
        const globalAvailablePrice = new Decimal(data.available);
        availablePrice.textContent = `${globalAvailablePrice.toFixed(2)} USDT`;
    }
}

function handleOrderBookUpdate(event){
    const orderBook = event.detail;
    const asksSide = document.getElementById("order-book__asks");
    updateOrderBookContent(asksSide, orderBook.asks);

    const bidsSide = document.getElementById("order-book__bids");
    updateOrderBookContent(bidsSide, orderBook.bids);
}

function updateOrderBookContent(element, orders) {
    // clear all child nodes
    while(element.firstChild){
        element.removeChild(element.firstChild);
    }

    orders.forEach(order => {
        const [price, total] = order;
        const priceDiv = document.createElement("div");
        const totalDiv = document.createElement("div");

        priceDiv.textContent = price;
        totalDiv.textContent = total;

        element.appendChild(priceDiv);
        element.appendChild(totalDiv);
    })
}

// update price
function handlePriceUpdate(event) {
    const currentPrice = new Decimal(event.detail.price);

    
    const priceElement = document.getElementById("order-book__price");
    if (priceElement) {
        priceElement.textContent = currentPrice.toFixed(2);

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

// buy sell button setting
function initTabsAndSubmit() {
    const buyButton = document.getElementById("trade-panel__tab--buy");
    const sellButton = document.getElementById("trade-panel__tab--sell");
    const submitButton = document.getElementById("trade-panel__submit");


    // init
    buyButton.classList.add("active");
    sellButton.classList.remove("active");
    submitButton.classList.add("buy")


    // status change
    buyButton.addEventListener("click", () => {
        buyButton.classList.add("active");
        sellButton.classList.remove("active");
        submitButton.classList.add("buy");   
        submitButton.classList.remove("sell");

    });

    sellButton.addEventListener("click", () => {
        sellButton.classList.add("active");
        buyButton.classList.remove("active");
        submitButton.classList.add("sell");
        submitButton.classList.remove("buy");
    });
}


function quickSelectButtonAndInputHandler(){
    const buttons = document.querySelectorAll(".trade-panel__quick-select button");
    const availablePriceElement = document.getElementById("trade-panel__available-price");
    const priceInput = document.getElementById("trade-panel__input--price");
    const quantityInput = document.getElementById("trade-panel__input--quantity");
    const totalInput = document.getElementById("trade-panel__input--total");
    const inputs = [priceInput, quantityInput, totalInput];

    function clearActiveButtons(){
        buttons.forEach(btn => btn.classList.remove("active"));
    }

    function calculateAndUpdate(changedInput){
        const price = new Decimal(priceInput.value || "0");
        const quantity = new Decimal(quantityInput.value || "0");
        const total = new Decimal(totalInput.value || "0");

        if(price.isZero()) return; // avoid division by zero

        if (changedInput === "price" || changedInput === "quantity") {
            totalInput.value = price.times(quantity).toFixed(2);
        } else if (changedInput === "total"){
            quantityInput.value = total.dividedBy(price).toFixed(8);
        }
    }

    // validate input, allow only number and decimal point
    function validateNumberInput(event){
        const input = event.target
        const value = input.value;

        // allow backspace and arrow keys
        if (event.key === "Backspace" || event.key === "ArrowLeft" || event.key === "ArrowRight"){
            return;
        }

        // check valid number input
        if(!/^\d*\.?\d*$/.test(value)){
            event.preventDefault();
            event.target.value = value.replace(/[^\d.]/g, "");
        }

        // ensure only one decimal point
        if ((value.match(/\./g) || []).length > 1){
            event.preventDefault();
            input.value = value.replace(/\.+$/, "");
        }
    }

    // percentage button click handler
    buttons.forEach(button => {
        button.addEventListener("click", function(){
            clearActiveButtons();
            this.classList.add("active");

            const availablePrice = new Decimal(availablePriceElement.textContent.replace(" USDT", ""));
            const currentPrice = new Decimal(priceInput.value || "0");
            const dataValue = new Decimal(this.dataset.value);

            const totalAmount = availablePrice.times(dataValue);
            const quantity = currentPrice.isZero()? new Decimal(0) : totalAmount.dividedBy(currentPrice);

            quantityInput.value = quantity.toFixed(8);
            totalInput.value = totalAmount.toFixed(2);

        })
    })

    // input focus, input , and keyboard event handling
    inputs.forEach(input => {
        input.addEventListener("focus", () => {
            clearActiveButtons();
        });

        // prevent arrow key from changing input value
        input.addEventListener("keydown", function(event) {
            if (event.key === "ArrowUp" || e.key === "ArrowDown") {
                event.preventDefault();
            }
        });

        input.addEventListener("input", (event) => {
            const inputId = event.target.id;
            const inputType = inputId.split("--")[1]; // price, quantity, or total
            calculateAndUpdate(inputType);
        });

        input.addEventListener("keydown", validateNumberInput);
    })

}


export async function initTradePanel() {
    initTradePanelWebSocket();
    initTabsAndSubmit(); 
    await initAvailableBalance();
    quickSelectButtonAndInputHandler();
}