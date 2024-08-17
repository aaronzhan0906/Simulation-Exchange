import express from "express";
import WalletController from "../controllers/walletController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)


router.get("/balance", WalletController.getBalance)
router.get("/available", WalletController.getAvailable)
router.get("/assets", WalletController.getAssets)

// 之後改多種資產
router.get("/assetbtc", WalletController.getAvailableAmount)

export default router