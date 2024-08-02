import express from "express";
import AccountController from "../controllers/accountController.js"
// import auth
const router = express.Router();



router.get("/preAuthorization", auth, AccountController.getBalance);

router.post("/complete-transaction", auth, AccountController.completeTransaction );

router.get("/history", auth , AccountController.geTransactionHistory );

router.get("/assets", auth , AccountController.getCurrentAssets);

router.post("/initialize", auth, AccountController.initializeAccount);

export default router