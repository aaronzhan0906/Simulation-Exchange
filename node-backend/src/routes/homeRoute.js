import express from "express";
import HomeController from "../controllers/homeController.js";
const router = express.Router();






// router.get("/transactions", HistoryController.getOrderHistory);
router.get("/symbols", HomeController.getSymbols); 

export default router