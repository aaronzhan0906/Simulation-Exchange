import Big from "big.js";
import Decimal from 'decimal.js';
import WalletModel from "../models/walletModel.js";
import TradeModel from "../models/tradeModel.js";
import kafkaProducer from "../services/kafkaProducer.js";
import { generateSnowflakeId } from "../utils/snowflake.js"

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
    async createOrder(req, res){
        try { 
            const { symbol, side, type, price, quantity } = req.body;
            const userId = req.user.userId;

            if ( !userId || !symbol || !side || !type || !price || !quantity) {
                return res.status(400).json({ error:true, message:"Missing required fields!" })
            }
            
            // snowflake order_id 
            const orderId = generateSnowflakeId();
      
            const orderIdString = orderId.toString();
            const order = await TradeModel.createOrder(
                orderIdString,
                userId,
                symbol,
                side,
                type,
                price,
                quantity,
                "open"
            );

     
            // send order to kafka
            await kafkaProducer.sendMessage("new-orders",{
                orderId: order.order_id,
                userId: order.user_id,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                price: order.price,
                quantity: order.quantity,
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
                    price: order.price,
                    quantity: order.price,
                    amount: order.amount,
                    status: order.status,
                    createdAt: order.created_at
                }
            })

        } catch(error) {
            console.error(error);
            throw error;
        }
    }

    async updateOrderData(trade_result){
        const {
            order_id,
            timestamp,
            executed_quantity,
            executed_price,
            status
        } = trade_result

        const updateOrderData = {
            order_id,
            executed_quantity: new Decimal(executed_quantity).toString(),
            executed_price: new Decimal(executed_price).toString(),
            status,
            updated_at: timestamp
        }
        
        try {  
            const resultOrderData = await TradeModel.updateOrderData(updateOrderData);
            if (!resultOrderData) {
                throw new Error('Order not found or update failed');
            }

            if (resultOrderData.side == "buy") {
                await TradeModel.increaseAsset(resultOrderData)
                await TradeModel.decreaseBalance(resultOrderData)
            } else {
                await TradeModel.decreaseAsset(resultOrderData)
                await TradeModel.increaseBalance(resultOrderData)
            }
            
        } catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    }


    // consumer 
    async createTradeHistory(trade_result){
        const {
            trade_id: originalTradeId,
            timestamp,
            symbol,
            side,
            executed_quantity,
            executed_price,
            buyer,
            seller
        } = trade_result

        const user_id = side === "buy" ? buyer.user_id : seller.user_id;
        const trade_id = side === "buy" ? `b${originalTradeId}` : `s${originalTradeId}`

        const tradeData = {
            user_id,
            trade_id,
            executed_at: new Date(timestamp),
            symbol,
            side,
            price: new Decimal(executed_price).toString(),
            quantity: new Decimal(executed_quantity).toString(),
            buyer_user_id: buyer.user_id,
            buyer_order_id: buyer.order_id,
            seller_user_id: seller.user_id,
            seller_order_id: seller.order_id
        };

        try {
            const result = await TradeModel.createTradeHistory(tradeData)
            if (result) console.log("Trade history created.")

        } catch(error) {
            console.error(error);
            throw error;
        }
    }


}


export default new TradeController();

