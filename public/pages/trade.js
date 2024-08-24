import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebSocket from "../services/tradeWS.js";

let chart;
let lineSeries;

function initChart() {
    const chartContainer = document.getElementById("chart");
    chart = createChart(chartContainer, {
        width: chartContainer.offsetWidth,
        height: 480,
        layout: {
            background: { type: "solid", color: "#000000" },
            textColor: "#ffffff",
        },
        grid: {
            vertLines: { color: "rgba(0, 0, 0, 0.5)" },
            horzLines: { color: "rgba(0, 0, 0, 0.5)" },
        },
        crosshair: {
            mode: "normal",
        },
        rightPriceScale: {
            borderColor: "rgba(0, 0, 0, 0.8)",
        },
        timeScale: {
            borderColor: "rgba(82, 80, 80, 0.8)",
            timeVisible: true,
            secondsVisible: false, // Hide seconds for a broader view
            tickMarkFormatter: (time, tickMarkType, locale) => {
                const date = new Date(time * 1000);
                return date.toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                });
            },
        },
    });

    lineSeries = chart.addAreaSeries({
        topColor: "rgba(41, 98, 255, 0.56)",
        bottomColor: "rgba(41, 98, 255, 0.04)",
        lineColor: "rgba(41, 98, 255, 1)",
        lineWidth: 2,
    });

}

function updateChart(price) {
    // Use a timestamp based on the current time
    const timestamp = Math.floor(Date.now() / 1000); // Convert to seconds
    lineSeries.update({
        time: timestamp, // Unix timestamp format
        value: parseFloat(price)
    });
}

document.addEventListener("DOMContentLoaded", () => {
    tradeWebSocket.init();
    initChart();
    initTradePanel();
    initializeHeader();    
    document.addEventListener("recentPrice", (event) => {
        const price = event.detail.price;
        updateChart(price);
    });
});
