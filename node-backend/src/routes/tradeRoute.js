import express from "express";
import TradeController from "../controllers/tradeController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)

// pre-authorization
router.get("/buyPreAuthorization", TradeController.buyPreAuthorization);
router.get("/sellPreAuthorization", TradeController.sellPreAuthorization);

// order
router.post("/createOrder", TradeController.createOrder);




export default router