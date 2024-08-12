export const checkLoginStatus = () => {
    const loginProof = localStorage.getItem("isLogin");
    return !!loginProof; 
}
