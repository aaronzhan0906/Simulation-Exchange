import HistoryModel from "../models/historyModel.js";

class HistoryController {

    async getTransactionHistory(req, res, next) {
        try {
            const transactions = await HistoryModel.getTransactionsById(req.user.userId);
            res.status(200).json({
                "ok": true,
                "transactions": transactions.map(transaction => ({
                    symbol: transaction.symbol,
                    side: transaction.side,
                    type: transaction.type,
                    price: transaction.price.toString(),
                    quantity: transaction.quantity.toString(),
                    amount: transaction.amount.toString(),
                    status: transaction.status,
                    executed_at:  transaction.executed_at 
                }))
            })
        } catch(error) {
            next(error);
        }
    }
}


export default new HistoryController();

