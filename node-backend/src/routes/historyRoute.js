import express from "express";
import HistoryController from "../controllers/historyController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)



// router.get("/transactions", HistoryController.getOrderHistory);
router.get("/transactions", HistoryController.getTransactionHistory );



export default router