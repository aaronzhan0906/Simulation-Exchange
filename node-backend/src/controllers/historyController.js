import HistoryModel from "../models/historyModel.js";

class HistoryController {
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
            console.error("HomeController.getSymbols", error);

        };
    }


    async getOrderHistory(req, res) {
        
    }

    // async getTransactionHistory(req, res) {
    //     try {
    //         const transactions = await HistoryModel.getTransactionsById(req.user.userId);
    //         res.status(200).json({
    //             "ok": true,
    //             "transactions": transactions.map(transaction => ({
    //                 symbol: transaction.symbol,
    //                 side: transaction.side,
    //                 type: transaction.type,
    //                 price: transaction.price.toString(),
    //                 quantity: transaction.quantity.toString(),
    //                 amount: transaction.amount.toString(),
    //                 status: transaction.status,
    //                 executed_at:  transaction.executed_at 
    //             }))
    //         })
    //     } catch(error) {
    //         console.error("getTransactionHistory", error);
    //     }
    // }
}


export default new HistoryController();

