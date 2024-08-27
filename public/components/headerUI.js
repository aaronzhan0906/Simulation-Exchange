import { checkLoginStatus } from "../utils/auth.js";

const headerLogoLink = document.getElementById("header__logo--link");
const homeLink = document.getElementById("header__link--home");
const tradeLink = document.getElementById("header__link--trade");
const walletLink = document.getElementById("header__link--wallet");
const historyLink = document.getElementById("header__link--history");

const buttonConfigs =[
    { class: "header__login", id: "header__login", text: "Login" },
    { class: "header__signup", id: "header__signup", text: "Sign Up" },
    { class: "header__logout", id: "header__logout", text: "Logout" },
];

const generateButton = () => {
    const headerActions = document.getElementById("header__actions");

    headerActions.innerHTML = "";

    buttonConfigs.forEach(config => {
        const button = document.createElement("button");
        button.id = config.id;
        button.textContent = config.text;
        button.className = `header__button ${config.class}`;
        headerActions.appendChild(button);
    });
}

const updateHeaderUI = () => {
    generateButton();
    const isLoggedIn = checkLoginStatus();

    const loginButton = document.getElementById("header__login");
    const signupButton = document.getElementById("header__signup");
    const logoutButton = document.getElementById("header__logout");

    if (loginButton) loginButton.style.display = isLoggedIn ? "none" : "flex";
    if (signupButton) signupButton.style.display = isLoggedIn ? "none" : "flex";
    if (logoutButton) logoutButton.style.display = isLoggedIn ? "flex" : "none";
}

const headerEventListeners = () => {
    if (headerLogoLink) {
        headerLogoLink.addEventListener("click", () => {
            location.href = "/";
        });
    }

    if (homeLink) {
        homeLink.addEventListener("click", () => {
            location.href = "/";
        });
    }

    if (tradeLink) {
        tradeLink.addEventListener("click", () => {
            location.href = "/trade/btc_usdt";
        });
    }

    if (walletLink) {
        walletLink.addEventListener("click", () => {
            location.href = "/wallet";
        });
    }

    if (historyLink) {
        historyLink.addEventListener("click", () => {
            location.href = "/history";
        });
    }

    const loginButton = document.getElementById("header__login");
    const signupButton = document.getElementById("header__signup");
    const logoutButton = document.getElementById("header__logout");

    if (loginButton) {
        loginButton.addEventListener("click", () => {
            location.href = "/login";
        });
    }

    if (signupButton) {
        signupButton.addEventListener("click", () => {
            location.href = "/signup";
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            logout();
        });
    }
}

const logout = async () => {
    try {
        const response = await fetch("/api/user/logout", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include"
        });

        if (response.ok) {
            localStorage.removeItem("isLogin");
            updateHeaderUI();
            location.href = "/"; 
        } else {
            const errorData = await response.json();
            console.error("Logout failed:", errorData.message);
        }
    } catch (error) {
        console.error("Logout error:", error);
    }
};


export const initializeHeader = () => {
    updateHeaderUI();
    headerEventListeners();
};
