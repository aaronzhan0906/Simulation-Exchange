import Big from "big.js";
import AccountModel from "../models/accountModel.js";
import { Kafka } from "kafkajs";
import kafkaProducer from "../services/kafkaProducer.js";

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

    // router.get("/history", AccountController.getTransactionHistory );
    async getTransactionHistory(req, res, next) {
        try {
            const transactions = await AccountTransaction.getTransactionsById(req.user.userId);
            res.status(200).json({
                "ok": true,
                "transactions": transactions.map(transaction => ({
                    symbol: transaction.symbol,
                    buy_sell: transaction.buy_sell,
                    amount: transaction.amount.toString(),
                    price: transaction.price.toString(),
                    status: transaction.status,
                    status_changes_at:  transaction.status_changes_at
                }))
            })
        } catch(error) {
            next(error);
        }
    }

    // router.get("/buyPreAuthorization", AccountController.buyPreAuthorization);
    async buyPreAuthorization(req, res, next){
        try {
            const { buyAmount, buyPrice } = req.body;
            const balance = new Big(AccountModel.getBalanceById(req.user.userId));
            const preAuthAmount = new Big(buyAmount).times(buyPrice);

            if (balance.lt(preAuthAmount)){
                return res.status(400).json({ error: true, message:"Insufficient balance"})
            }

            const remainingBalance = balance.minus(preAuthAmount);
            res.status(200).json({
                ok: true,
                message: "Pre-authorization successful",
                remainingBalance: remainingBalance.toString()
            })
        } catch(error) {
            next(error);
        }
    }

    // router.get("/sellPreAuthorization", AccountController.sellPreAuthorization);
    async sellPreAuthorization(req, res, next){
        try { 
            const { symbol, sellAmount } = req.body;
            const amount = AccountModel.getAmountOfSymbolById(req.user.userId, symbol)

            if (amount.lt(sellAmount)){
                return res.status(400).json({ error: true, message:"Insufficient asset"})
            }

            const remainingAsset = amount.minus(sellAmount);
            res.status(200).json({
                ok: true,
                message: "Pre-authorization successful",
                remainingAsset: remainingAsset.toString()
            })
        } catch(error) {
            next(error);
        }
    }

    // router.post("/createOrder", AccountController.createOrder);
    async createOrder(req, res, next){
        try { 
            const { symbol, orderType, amount, price } = req.body;
            const { userId } = req.user.userId;

            if ( !userId || !symbol || !orderType || !amount || !price) {
                return res.status(400).json({ error:true, message:"Missing required fields" })
            }

            const order = await AccountModel.createOrder({
                user_id: userId,
                symbol,
                order_type: orderType,
                amount,
                price,
                status: pending
            })

            // send order to kafka
            await kafkaProducer.sendMessage("new-orders",{
                orderId: order.order_id,
                userId: order.user_id,
                symbol: order.symbol,
                orderType: order.order_type,
                amount: order.amount.toString(),
                price: order.price.toString(),
                status: order.status,
                createdAt: order.created_at
            })

            res.status(200).json({
                ok: true,
                message: "Order created successfully",
                order: {
                    orderId: order.order_id,
                    userId: order.user_id,
                    symbol: order.symbol,
                    orderType: order.order_type,
                    amount: order.amount.toString(),
                    price: order.price.toString(),
                    status: order.status,
                    createdAt: order.created_at
                }
            })

        } catch(error) {
            next(error);
        }
    }

    async transactionCompleted(req, res, next){
        try { 
           console.log("hello")

        } catch(error) {
            next(error);
        }
    }
}


export default new AccountController();

