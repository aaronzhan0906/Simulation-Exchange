import { initializeHeader } from "../components/headerUI.js";


// State management, checking if the user is logged in
export function checkLoginStatus () {
    const loginProof = localStorage.getItem("isLogin");
    return !!loginProof; 
}

// Check every time the page is loaded if not logged in remove loginProof
export async function checkLoginStatusOnPageLoad(){
    const loginProof = localStorage.getItem("isLogin");
    if(!loginProof) return;

    const response = await fetch("/api/user/auth")
    const responseData = await response.json()

    if (responseData.error) {
        console.log("remove")
        localStorage.removeItem("isLogin");
        alert(responseData.message)
        initializeHeader();
    }
}
