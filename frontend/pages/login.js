document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login__form");
    const emailInput = document.getElementById("login__form--email");
    const passwordInput = document.getElementById("login__form--password");
    const homeLink = document.getElementById("header__logo--link");


    homeLink.addEventListener("click", (event) => {
        event.preventDefault();
        location.href = "/";
    });

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault(); 

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Please enter both email and password");
            return;
        }

        try {
            const response = await fetch("/api/user/auth", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
                credentials: "include"
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("isLogin", data.loginProof );
                window.location.href = "/";
            } else {
                alert(data.message || "Login failed. Please try again.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again later.");
        }
    });

    const signupLink = document.getElementById("signup__link");
    signupLink.addEventListener("click", () => {
        window.location.href = "/signup";
    });

    const logoLink = document.getElementById("header__logo--link");
    logoLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = "/";
    });
});