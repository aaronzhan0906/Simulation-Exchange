import express from "express";
import HistoryController from "../controllers/historyController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken) // jwt token middleware



router.get("/orders", HistoryController.getOrderHistory);
router.get("/symbols", HistoryController.getSymbols); 



export default router