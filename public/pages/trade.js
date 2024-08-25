import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import tradeWebSocket from "../services/tradeWS.js";

let chart;
let lineSeries;
let lastDataPoint = null;
let lastUpdateHour = -1; // for 30d chart refresh only once per hour

async function fetchHistoricalData() {
    const response = await fetch("/api/quote/monthly-trend/BTCUSDT");
    const data = await response.json();
    const monthlyTrend = data.monthlyTrend;
    
    const processedData = []
    for (let i = 0; i < monthlyTrend.length; i+=2){
        const priceData = JSON.parse(monthlyTrend[i]);
        const timestamp = parseInt(monthlyTrend[i+1]);

        processedData.push({
            time: timestamp / 1000, // convert to seconds
            value: parseFloat(priceData.open) 
        });
    }

    return processedData.sort((a, b) => a.time - b.time);
}


async function initChart() {
    const chartContainer = document.getElementById("chart");
    chart = createChart(chartContainer, {
        width: chartContainer.offsetWidth,
        height: 400,
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
            secondsVisible: false,
        },
    });

    lineSeries = chart.addAreaSeries({
        topColor: "rgba(41, 98, 255, 0.56)",
        bottomColor: "rgba(41, 98, 255, 0.04)",
        lineColor: "rgba(41, 98, 255, 1)",
        lineWidth: 2,
    });

    try {
        const historicalData = await fetchHistoricalData();
        console.log("Historical data:", historicalData); 

        if (Array.isArray(historicalData) && historicalData.length > 0) {
            lineSeries.setData(historicalData);
            chart.timeScale().fitContent();

            const lastDataPoint = historicalData[historicalData.length - 1];
            lastUpdateHour = new Date(lastDataPoint.time * 1000).getHours();
        } else {
            console.error("Invalid historical data format");
        }
    } catch (error) {
        console.error("Error initializing chart:", error);
    }
}



function updateChart(price) {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const timestamp = Math.floor(now.getTime() / 1000);

    if (currentHour !== lastUpdateHour || lastDataPoint === null) {
        lastDataPoint = { // add new data point
            time: timestamp,
            value: parseFloat(price)
        };
        lineSeries.update(lastDataPoint);
        lastUpdateHour = currentHour;
    } else { // update data point in a hour
        lastDataPoint.value = parseFloat(price);
        lineSeries.update(lastDataPoint);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    tradeWebSocket.init();
    await initChart(); 
    initTradePanel();
    initializeHeader();    
    document.addEventListener("recentPrice", (event) => {
        const price = event.detail.price;
        updateChart(price);
    });
});
