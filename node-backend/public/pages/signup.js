document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("signup__form");
    const emailInput = document.getElementById("signup__form--email");
    const passwordInput = document.getElementById("signup__form--password");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault(); 

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Please enter both email and password");
            return;
        }

        try {
            const response = await fetch("/api/user/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = "/login";
            } else {
                alert(data.message || "Signup failed. Please try again.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again later.");
        }
    });

    const signupLink = document.querySelector(".login__link");
    signupLink.addEventListener("click", () => {
        window.location.href = "/signup";
    });

    const logoLink = document.querySelector(".header__logo--link");
    logoLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = "/";
    });
});