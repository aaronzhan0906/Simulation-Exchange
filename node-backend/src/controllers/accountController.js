import Big from "big.js";
import AccountModel from "../models/accountModel.js";


class AccountController {
    // router.get("/balance", AccountController.getBalance)
    async getBalance(req, res, next) {
        try {
            const balance = await AccountModel.getBalanceById(req.user.userId);
            res.status(200).json({ "ok": true, "balance": balance });
        } catch(error) {
            next(error);
        }
    }

    // router.get("/assets". AccountController.getAssets)
    async getAssets(req, res, next) {
        try {
            const assets = await AccountModel.getAssetsById(req.user.userId);
            res.status(200).json({ 
                "ok": true, 
                "assets": assets.map(asset => ({
                    symbol: asset.symbol,
                    amount: asset.amount.toString(),
                    average_purchase_cost: asset.average_purchase_cost.toString()
                }))
            });
        } catch(error) {
            next(error);
        }
    }
}


export default new AccountController();

