import express from "express";
import WalletController from "../controllers/walletController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken) // jwt token middleware


// router.get("/balance", WalletController.getBalance)
router.get("/available", WalletController.getAvailable)
router.get("/balanceOverview", WalletController.getBalanceOverView)
router.get("/assetsAndSymbols", WalletController.getAssetsAndSymbols)
router.get("/asset/:symbol", WalletController.getAvailableAmount)

export default router