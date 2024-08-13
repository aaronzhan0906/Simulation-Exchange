import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebSocket from "../components/orderBookUI.js";


document.addEventListener("DOMContentLoaded", (event) => {
    initializeHeader();
    tradeWebSocket.init();
    initTradePanel()

});
