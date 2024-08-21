import { initializeHeader } from "../components/headerUI.js";

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    initBalance();
});

async function initBalanceOverview () {
    const balanceValueTotal = document.getElementById("balance-value__total");
        const balanceValueAvailable = document.getElementById("balance-value__available");
        const balanceValueLocked = document.getElementById("balance-value__locked");

    try {
        const response = await fetch("/api/wallet/balance");
        const data = await response.json();
        balanceValueTotal.textContent = data.balance;
        balanceValueAvailable.textContent = data.available;
        balanceValueLocked.textContent = data.locked;

    } catch (error) {
        console.error("Error in initBalanceOverview():",error);
    }
}

async function initBalance(){
    const setItemAmount = document.getElementById("asset-item__amount--fixed");

    try {
        const response = await fetch("/api/wallet/balance");
        const data = await response.json();
        console.log(data.balance);
        setItemAmount.textContent = `${data.balance} USDT` ;
    } catch (error) {
        console.error("Error in initBalance():",error);
    }
}