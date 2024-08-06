import express from "express";
import HistoryController from "../controllers/accountController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)



router.get("/orders", HistoryController.getOrderHistory );
router.get("/transactions", HistoryController.getTransactionHistory );



export default router