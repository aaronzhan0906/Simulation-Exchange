const headerLogoLink = document.getElementById("header__logo--link");
const homeLink = document.getElementById("header__link--home");
const tradeLink = document.getElementById("header__link--trade");
const walletLink = document.getElementById("header__link--wallet");
const historyLink = document.getElementById("header__link--history");
const loginButton = document.getElementById("header__login");
const signupButton = document.getElementById("header__signup");

function headerEventListeners() {
    headerLogoLink.addEventListener("click", () => {
        location.href = "/";
    });

    homeLink.addEventListener("click", () => {
        location.href = "/";
    });

    tradeLink.addEventListener("click", () => {
        location.href = "/trade";
    });

    walletLink.addEventListener("click", () => {
        location.href = "/wallet";
    });

    historyLink.addEventListener("click", () => {
        location.href = "/history";
    });

    loginButton.addEventListener("click", () => {
        location.href = "/login";
    });

    signupButton.addEventListener("click", () => {
        location.href = "/signup";
    });
}


export { headerEventListeners };
