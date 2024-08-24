import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebSocket from "../services/tradeWS.js";

document.addEventListener("DOMContentLoaded", () => {
    tradeWebSocket.init();
    initTradePanel();
    initializeHeader();    
});