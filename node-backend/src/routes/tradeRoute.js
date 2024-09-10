import express from "express";
import TradeController from "../controllers/tradeController.js";
import authenticateToken from "../middlewares/authMiddleware.js";
const router = express.Router();
import "express-async-errors";

const asyncHandler = (func) => (req, res, next) =>
    Promise.resolve(func(req, res, next)).catch(next);


router.use(authenticateToken) // jwt token middleware

// get orders
router.get("/order", asyncHandler(TradeController.getOrders));
// create order
router.post("/order", asyncHandler(TradeController.createOrder));
// cancel order
router.patch("/order", asyncHandler(TradeController.cancelOrder));

router.use((err, req, res) => {
    console.error(`Error occurred at path: ${req.path}`);
    console.error(`Error message: ${err.message}`);
    console.error(`Error stack: ${err.stack}`);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        error: true,
        path: req.path,
        message: err.message
    });
})

export default router