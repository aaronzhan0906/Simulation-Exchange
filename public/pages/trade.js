import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebSocket from "../utils/tradeWebsocket.js";

document.addEventListener("DOMContentLoaded", (event) => {
    tradeWebSocket.init();

    initializeHeader();
    initTradePanel();
});