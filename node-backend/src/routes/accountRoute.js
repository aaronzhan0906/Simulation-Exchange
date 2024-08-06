import express from "express";
import AccountController from "../controllers/accountController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();


router.use(authenticateToken)


router.get("/balance", AccountController.getBalance)
router.get("/assets", AccountController.getAssets)


export default router