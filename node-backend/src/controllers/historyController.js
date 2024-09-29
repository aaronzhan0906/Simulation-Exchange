import HistoryModel from "../models/historyModel.js";
import { logger } from "../app.js";

class HistoryController {
    // router.get("/symbols", HistoryController.getSymbols); 
    async getSymbols(req, res) {
        try {
            const symbols = await HistoryModel.getSymbols();
            
            res.status(200).json({
                "ok": true,
                message: "Get symbols successfully",
                "data": symbols.map(symbol => ({
                    symbolId: symbol.symbol_id,
                    symbolName: symbol.name,
                    imageUrl: symbol.image_url
                }))
            });
        } catch(error) {
            logger.error(`[getSymbols(history)]: ${error}`)
        };
    }

    // router.get("/orders", HistoryController.getOrderHistory);
    async getOrderHistory(req, res) {
        const { userId } = req.user;
        const { timeRange } = req.query;
        try {
            const orders = await HistoryModel.getOrderHistory(userId, timeRange);

            res.status(200).json({
                "ok": true,
                message: "Get order history successfully",
                "data": orders.map(order => ({
                    time: order.created_at,
                    symbol: order.symbol,
                    side: order.side,
                    type: order.type,
                    price: order.price.toString(),
                    quantity: order.quantity.toString(),
                    filled: order.executed_quantity.toString(),
                    averagePrice: order.average_price.toString(),
                    status: order.status
                }))
            })
        } catch(error) {
            logger.error(`[getOrderHistory]: ${error}`)
        }
    }
}


export default new HistoryController();

