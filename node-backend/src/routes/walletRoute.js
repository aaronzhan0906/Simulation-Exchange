import express from "express";
import WalletController from "../controllers/walletController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)


router.get("/balance", WalletController.getBalance)
router.get("/available", WalletController.getAvailable)
router.get("/assets", WalletController.getAssets)

router.get("/asset/:symbol", WalletController.getAvailableAmount)

export default router