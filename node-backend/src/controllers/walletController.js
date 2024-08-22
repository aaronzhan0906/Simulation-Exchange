import WalletModel from "../models/walletModel.js";
import Decimal from "decimal.js";



class WalletController {
    // router.get("/balance", AccountController.getBalance)
    // async getBalance(req, res) {
    //     try {
    //         const { balance } = await WalletModel.getBalanceById(req.user.userId);
    //         const deBalance = new Decimal(balance).toFixed(2);
    //         res.status(200).json({ "ok": true, "balance": deBalance });
    //     } catch(error) {
    //         console.error("Failed to get balance:", error);
    //     }
    // }

    // router.get("/available", AccountController.getAvailable)
    async getAvailable (req, res){
        try {
            const result = await WalletModel.getAvailableBalanceById(req.user.userId);
            res.status(200).json({ "ok": true, "available": result["available_balance"] });
        } catch(error) {
            console.error("Failed to get available:", error);
        }
    }

    // router.get("/balanceOverview", WalletController.getBalanceOverView)
    async getBalanceOverView(req, res) {
        try {
            const { balance, available_balance, locked_balance } = await WalletModel.getBalanceOverView(req.user.userId);
            const deBalance = new Decimal(balance).toFixed(2);
            const deAvailable = new Decimal(available_balance).toFixed(2);
            const deLocked = new Decimal(locked_balance).toFixed(2);
            res.status(200).json({ "ok": true, "balance": deBalance, "available": deAvailable, "locked": deLocked });
        } catch(error) {
            console.error("Failed to get available and locked:", error);
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

    // router.get("/assets/symbols", WalletController.getAssetsAndSymbols)
    async getAssetsAndSymbols(req, res) {
        try {
            const assets = await WalletModel.getAssetsAndSymbols(req.user.userId);
            console.log(assets);
            res.status(200).json({ 
                "ok": true, 
                "assets": assets.map(asset => ({
                    symbol: asset.symbol,
                    amount: asset.quantity,
                    averagePrice: asset.average_price,
                    availableQuantity: asset.available_quantity,
                    lockedQuantity: asset.locked_quantity,
                    imageUrl: asset.image_url
                }))
            });
        } catch(error) {
            console.error("Failed to get assets:", error);
        }
    }


}


export default new WalletController();

