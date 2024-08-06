import Big from "big.js";
import WalletModel from "../models/walletModel.js";
import TradeModel from "../models/tradeModel.js";
import kafkaProducer from "../services/kafkaProducer.js";

class TradeController {
    // router.get("/buyPreAuthorization", TradeController.buyPreAuthorization);
    async buyPreAuthorization(req, res, next){
        try {
            const { buyPrice, buyQuantity } = req.body;
            const balance = new Big(WalletModel.getBalanceById(req.user.userId));
            const preAuthAmount = new Big(buyQuantity).times(buyPrice);

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

    // router.get("/sellPreAuthorization", TradeController.sellPreAuthorization);
    async sellPreAuthorization(req, res, next){
        try { 
            const { symbol, sellQuantity } = req.body;
            const amount = WalletModel.getAmountOfSymbolById(req.user.userId, symbol)

            if (amount.lt(sellQuantity)){
                return res.status(400).json({ error: true, message:"Insufficient asset"})
            }

            const remainingAsset = amount.minus(sellQuantity);
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
            const { symbol, side, type, price, quantity } = req.body;
            const { userId } = req.user.userId;

            if ( !userId || !symbol || !orderType || !amount || !price) {
                return res.status(400).json({ error:true, message:"Missing required fields" })
            }
            
            // snowflake order_id 
            const orderId = generateSnowflakeId();
            const order = await TradeModel.createOrder({
                order_id: orderId,
                user_id: userId,
                symbol,
                side,
                type,
                price,
                quantity,
                amount,
                status: "pending"
            })

            // send order to kafka
            await kafkaProducer.sendMessage("new-orders",{
                orderId: order.order_id,
                userId: order.user_id,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                price: order.price.toString(),
                quantity: order.price.toString(),
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
                    side: order.side,
                    type: order.type,
                    price: order.price.toString(),
                    quantity: order.price.toString(),
                    amount: order.amount.toString(),
                    status: order.status,
                    createdAt: order.created_at
                }
            })

        } catch(error) {
            next(error);
        }
    }


    // consumer 
    async processCompletedTransaction(transactionData){
        const { transactionId, orderId, userId, symbol, side, type, price, quantity, amount, executedAt } = transactionData;

        try { 
           const updateOrder = await TradeModel.updateOrderStatus(orderId, "completed" , executedAt);

           // update account
           let updateAccount;
           if (side === "buy") {
                updateAccount = await TradeModel.decreaseBalance(userId, amount);
                await TradeModel.increaseAsset(userId, symbol, quantity);
           } else if ( side === "sell") {
                updateAccount = await TradeModel.increaseBalance(userId, amount);
                await TradeModel.decreaseAsset(userId, symbol, quantity);
           }

           const transaction = await TradeModel.createTransaction({
                transaction_id: transactionId,
                order_id: orderId,
                user_id: userId,
                symbol,
                side,
                type,
                price,
                quantity,
                amount,
                executed_at: executedAt
           });

           console.log(`Transaction ${transaction} processed successfully`);

        } catch(error) {
            next(error);
        }
    }
}


export default new TradeController();

