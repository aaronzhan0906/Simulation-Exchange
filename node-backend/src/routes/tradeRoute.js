import express from "express";
import TradeController from "../controllers/tradeController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)


router.get("/buyPreAuthorization", TradeController.buyPreAuthorization);
router.get("/sellPreAuthorization", TradeController.sellPreAuthorization);

// order
router.post("/createOrder", AccountController.createOrder);
// router.get("/updateOrder", AccountController.updateOrder);

// transaction
router.post("/transactionCompleted", AccountController.transactionCompleted);



export default router