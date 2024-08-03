import express from "express";
import AccountController from "../controllers/accountController.js"
import authenticateToken from "../middlewares/authMiddleware.js"
const router = express.Router();


router.use(authenticateToken)


router.get("/balance", AccountController.getBalance)
router.get("/assets". AccountController.getAssets)
router.get("/history", AccountController.getTransactionHistory );
router.get("/buyPreAuthorization", AccountController.buyPreAuthorization);
router.get("/sellPreAuthorization", AccountController.sellPreAuthorization);


// order
router.post("/createOrder", AccountController.createOrder);
// router.get("/updateOrder", AccountController.updateOrder);

// transaction
router.post("/transactionCompleted", AccountController.transactionCompleted);

export default router