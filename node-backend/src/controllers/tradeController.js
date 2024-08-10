import Decimal from 'decimal.js';
import TradeModel from "../models/tradeModel.js";
import kafkaProducer from "../services/kafkaProducer.js";
import { generateSnowflakeId } from "../utils/snowflake.js"

class TradeController {
    // router.post("/createOrder", AccountController.createOrder);
    async createOrder(req, res){
        try { 
            const { symbol, side, type, price, quantity } = req.body;
            const userId = req.user.userId;

            if ( !userId || !symbol || !side || !type || !price || !quantity) {
                return res.status(400).json({ error:true, message:"Missing required fields!" })
            }

            if (side === "buy") {
                await preBuyAuth(userId, price, quantity);
            } else if (side === "sell") {
                await preSellAuth(userId, symbol, quantity);
            } else {
                throw new Error("Invalid side");
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
                throw new Error("Order not found or update failed"); 
            }

            if (resultOrderData.side == "buy") {
                await TradeModel.increaseAsset(resultOrderData)
                await TradeModel.decreaseBalance(resultOrderData)
                await TradeModel.unlockBalance(resultOrderData)
            } else {
                await TradeModel.decreaseAsset(resultOrderData)
                await TradeModel.increaseBalance(resultOrderData)
                await TradeModel.unlockAsset(resultOrderData)
            }
            
        } catch (error) {
            console.error("updateOrderData error:", error);
            throw error;
        }
    }


    // async cancelOrder(req, res){
    //     const { orderId, side, price, quantity } = req.body;
    //     const userId = req.user.userId;

    //     if ( !userId || !orderId ) {
    //         return res.status(400).json({ error:true, message:"Missing required fields!" })
    //     }

    //     try {
    //         const resultStatus = await TradeModel.cancelOrder(orderId, userId);
    //         if (!resultStatus) {
    //             return res.status(400).json({ error: true, message: "Order not found or update failed" });
    //         }
    
    //         if (side === "buy") {
    //             await TradeModel.unlockBalance(orderId, userId, price, quantity);
    //         } else {
    //             await TradeModel.unlockAsset(orderId, userId, quantity);
    //         }
    
    //         return res.status(200).json({ ok: true, message: "Order cancelled successfully and assets unlocked", status: resultStatus });
    //     } catch(error) {
    //         console.error("cancelOrder error:", error);
    //         throw error;
    //     }
    // }    


    // consumer trade result from kafka
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
            console.error("createTradeHistory error, error:", error);
            throw error;
        }
    }


}


export default new TradeController();



async function preBuyAuth(userId, price, quantity) {
    const dPrice = new Decimal(price)
    const dQuantity = new Decimal(quantity)
    const costAmount = dPrice.times(dQuantity)  

    try {
        const availableBalance = await TradeModel.getAvailableBalanceById(userId)
        const usableBalance = new Decimal(availableBalance);
        if (usableBalance.lessThan(costAmount)) {
            return res.status(400).json({ error:true, message:"Insufficient available balance" });
        } 
        await TradeModel.lockBalance(userId, price, quantity)
    } catch (error) {
        console.error("preBuyAuth error:", error);
        throw error;
    } 
}


async function preSellAuth(userId, symbol, quantity) {
    const sellQuantity = new Decimal(quantity)
    try {
        const availableQuantity = await TradeModel.getQuantityBySymbolAndUserId(userId, symbol);
        if (new Decimal(availableQuantity).lessThan(sellQuantity)) {
            return res.status(400).json({ error:true, message:"Insufficient available asset" });
        }
        await TradeModel.lockAsset(userId, symbol, quantity)
    } catch (error) {
        console.error("preSellAuth error:", error);
        throw error;
    }
}
