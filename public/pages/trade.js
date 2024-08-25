import { initializeHeader } from "../components/headerUI.js";
import { initTradePanel } from "../components/tradePanelUI.js";
import { symbolsData } from "../data/symbolsData.js";
import tradeWebSocket from "../services/tradeWS.js";

let chart;
let lineSeries;
let lastDataPoint = null;
let lastUpdateHour = -1; // for 30d chart refresh only once per hour


// CHART HEADER ////////////////////////////////////////////////////
const pair = location.pathname.split("/")[2];
const baseAsset = pair.split("_")[0];

async function initChartHeader() {
    // symbol and ticker info
    const symbolInfo = symbolsData.data.find(symbol => symbol.symbolName === baseAsset);
    const icon = document.getElementById("chart-header__icon");
    const baseAssetName = document.getElementById("chart-header__base-asset");
    const quoteAsset = document.getElementById("chart-header__quote-asset");
        
    baseAssetName.textContent = symbolInfo.symbolName.toUpperCase();
    quoteAsset.textContent = `/${pair.split("_")[1].toUpperCase()}`;
    icon.src = symbolInfo.imageUrl;

    // high and low price
    const highDiv = document.getElementById("chart-header__high");
    const lowDiv = document.getElementById("chart-header__low");
    const response = await fetch(`/api/quote/24h-high-low/${pair}`);
    const responseData = await response.json();

    highDiv.firstElementChild.textContent = "24h Highest";
    lowDiv.firstElementChild.textContent = "24h Lowest";
    
    if (response.ok) {
        const high = parseFloat(responseData.data.high).toFixed(2);
        const low = parseFloat(responseData.data.low).toFixed(2);
        highDiv.lastElementChild.textContent = high;
        lowDiv.lastElementChild.textContent = low;
    }
}



async function fetchHistoricalData() {
    const upperCasePair = pair.toUpperCase().replace("_", "");
    const response = await fetch(`/api/quote/monthly-trend/${upperCasePair}`);
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
    const chartContainer = document.getElementById("chart-container");
    chart = createChart(chartContainer, {
        layout: {
            background: { type: "solid", color: "rgba(13, 14, 15)" },
            textColor: "#ffffff",
        },
        grid: {
            vertLines: { color: "rgba(13, 14, 15, 0.5)" },
            horzLines: { color: "rgba(13, 14, 15, 0.5)" },
        },
        rightPriceScale: {
            borderColor: "rgba(13, 14, 15, 0.5)",
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
    initChartHeader();
    await initChart(); 
    initTradePanel();
    initializeHeader();    
    document.addEventListener("recentPrice", (event) => {
        const price = event.detail.price;
        updateChart(price);
    });
});
