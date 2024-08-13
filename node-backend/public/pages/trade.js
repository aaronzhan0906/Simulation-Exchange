import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebsocket from "../utils/tradeWebsocket.js";


document.addEventListener("DOMContentLoaded", (event) => {
    initializeHeader();
    tradeWebsocket.init();
    initTradePanel()

});
