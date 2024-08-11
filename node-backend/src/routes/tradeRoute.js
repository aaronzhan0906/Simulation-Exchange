import express from "express";
import TradeController from "../controllers/tradeController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)

// create order
router.post("/order", TradeController.createOrder);

// cancel order
router.patch("/order", TradeController.cancelOrder);



export default router