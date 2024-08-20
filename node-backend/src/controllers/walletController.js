import WalletModel from "../models/walletModel.js";


class WalletController {
    // router.get("/balance", AccountController.getBalance)
    async getBalance(req, res, next) {
        try {
            const balance = await WalletModel.getBalanceById(req.user.userId);
            res.status(200).json({ "ok": true, "balance": balance });
        } catch(error) {
            console.error("Failed to get balance:", error);
        }
    }

    // router.get("/available", AccountController.getAvailable)
    async getAvailable (req, res){
        try {
            const result = await WalletModel.getAvailableById(req.user.userId);
            res.status(200).json({ "ok": true, "available": result["available_balance"] });
        } catch(error) {
            console.error("Failed to get available:", error);
        }
    }

    // router.get("/assets". AccountController.getAssets)
    async getAssets(req, res) {
        try {
            const assets = await WalletModel.getAssetsById(req.user.userId);
            res.status(200).json({ 
                "ok": true, 
                "assets": assets.map(asset => ({
                    symbol: asset.symbol,
                    amount: asset.amount.toString(),
                    average_purchase_cost: asset.average_purchase_cost.toString()
                }))
            });
        } catch(error) {
            console.error("Failed to get assets:", error);
        }
    }

    // router.get("/asset/:symbol", WalletController.getAvailableAmount)
    async getAvailableAmount(req, res) {
        try {
            const { symbol } = req.params;
            const amountOfSymbol = await WalletModel.getAvailableAmountOfSymbol(req.user.userId, symbol);
            res.status(200).json({ 
                "ok": true, 
                "amount": amountOfSymbol
            });
        } catch(error) {
            console.error("Failed to get amount of symbol:", error);
        }
    }


}


export default new WalletController();

