import Decimal from "decimal.js";
import TradeModel from "../models/tradeModel.js";
import kafkaProducer from "../services/kafkaProducer.js";
import { generateSnowflakeId } from "../utils/snowflake.js"
import WebSocket from "ws";
import { wss } from "../app.js";



class TradeController {
    // router.get("/order", TradeController.getOrders);
    async getOrders(req, res){
        const userId = req.user.userId;

        try {
            const result = await TradeModel.getOrders(userId)
            const formattedOrders = result.map(order => ({
                orderId: order.order_id,
                userId: order.user_id,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                price: order.price,
                quantity: order.quantity,
                status: order.status,
                createdAt: order.created_at
            }));

            return res.status(200).json({
                ok: true,
                message: "Orders retrieved successfully",
                orders: formattedOrders});
        } catch(error) {
            console.error("getOrders error:", error);
            throw error;
        }
    }
        
    // router.post("/order", TradeController.createOrder);
    async createOrder(req, res){
        const { symbol, side, type, price, quantity } = req.body;
            const userId = req.user.userId;

            if ( !userId || !symbol || !side || !type || !price || !quantity) {
                return res.status(400).json({ error:true, message:"Missing required fields!" })
            }

        try { 
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
                    quantity: order.quantity,
                    status: order.status,
                    createdAt: order.created_at
                }
            })

        } catch(error) {
            console.error(error);
            throw error;
        }
    }

    // WS broadcast order update
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
            // websocket broadcast
            const quantity = new Decimal(resultOrderData.quantity)
            const remainingQuantity = new Decimal(resultOrderData.remaining_quantity)
            const filledQuantity = quantity.minus(remainingQuantity).toString()
            broadcastOrderUpdate(resultOrderData, filledQuantity);
            
        } catch (error) {
            console.error("updateOrderData error:", error);
            throw error;
        }
    }

    // WS broadcast order book
    async broadcastOrderBook(orderBookSnapshot) {
        const rawAsks = orderBookSnapshot.asks.map( order => {
            return [Decimal(order.price).toFixed(2), Decimal(order.quantity).toFixed(5)]
        });
        const rawBids = orderBookSnapshot.bids.map( order => { 
            return [Decimal(order.price).toFixed(2), Decimal(order.quantity).toFixed(5)]})
        const askArray = rawAsks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).slice(-10).reverse();
        const bidArray = rawBids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 10);
        const processedData = {
            asks: askArray,
            bids: bidArray
        }
        try {
            const message = JSON.stringify({
                type: "orderBook",
                data: processedData
            })

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN){
                    client.send(message)
                }
            })
        } catch (error) {
            console.error("broadcastOrderBook error:", error);
            throw error;
        }
    }

    // WS broadcast current trade and time 
    async broadcastRecentTrade(trade_result) {
        const { side, executed_price, timestamp, isTaker } = trade_result;
        if (!isTaker) {
            return;
        }

        try {
            const message = JSON.stringify({
                type: "recentTrade",
                data: {
                    side,
                    price: executed_price,  
                    timestamp
                }
            });
    
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        } catch (error) {  
            console.error("broadcastRecentTrade error:", error);
            throw error;
        }
    }


    // router.patch("/order", TradeController.cancelOrder);
    async cancelOrder(req, res){
        const { orderId, symbol } = req.body;
        const userId = req.user.userId;

        if ( !userId || !orderId || !symbol) {
            return res.status(400).json({ error:true, message:"Missing required fields!" })
        }

        try {
            const cancelResultPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    if (pendingCancelResults.has(orderId)) {
                        pendingCancelResults.delete(orderId);
                        reject(new Error("Cancel request timeout"));
                    }
                }, 30000);
    
                pendingCancelResults.set(orderId, { resolve, reject, timeoutId, timestamp: new Date() });
            });
            await kafkaProducer.sendMessage("cancel-orders", { orderId, userId, symbol });
            const cancelResult = await cancelResultPromise;
            
            if (cancelResult.status === "filled") {
                return res.status(401).json({ error:true, message:"Order not found or already fully executed" });
            } 

            const updateOrderId = cancelResult.order_id;
            const updateStatus = cancelResult.status;
            const updateUpdateAt = cancelResult.timestamp;
            const updateResult = await TradeModel.cancelOrder(updateOrderId, updateStatus, updateUpdateAt);
            
            if (!updateResult) {
                return res.status(400).json({
                    error: true,
                    message: "Unexpected cancellation result",
                    status: cancelResult.status
                });
            }

            

            if (cancelResult.side === "buy") {
                await TradeModel.releaseLockedBalance(cancelResult);
            } else {
                await TradeModel.releaseLockedAsset(cancelResult);
            }

            if (cancelResult.status === "CANCELED" || cancelResult.status === "PARTIALLY_FILLED_CANCELED") {
                return res.status(200).json({
                    ok: true,
                    message: "Order cancelled successfully",
                    orderId: updateResult.updateOrderId,
                    status: updateResult.updateStatus,
                    updatedAt: updateResult.updateUpdatedAt
                });
            } 
           
        } catch(error) {
            console.error("cancelOrder error:", error);
            pendingCancelResults.delete(orderId); 
            if (error.message === "Cancel order request timeout") {
                return res.status(408).json({ error:true, message:"Cancel order request timeout" });
            }
        }
    }    

    async processCancelResult(data) {        
        try {
            await TradeModel.cancelOrder(data.orderId, data.status);
            
            console.log(`Cancel result processed successfully for order: ${data.order_id}`);
        } catch (error) {
            console.error(`Error processing cancel result for order ${data.orderId}:`, error);
        }
    }


    // consume trade result from kafka
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

// pending cancel orders
export const pendingCancelResults = new Map()

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

async function broadcastOrderUpdate(resultOrderData, filledQuantity) {
    const message = JSON.stringify({
        type: "orderUpdate",
        data: {
            orderId: resultOrderData.order_id,
            filledQuantity: filledQuantity,
            averagePrice: resultOrderData.average_price,
            status: resultOrderData.status,
        }
    })

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN){
            client.send(message)
        }
    })

}