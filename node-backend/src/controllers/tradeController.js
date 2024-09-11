import Decimal from "decimal.js";
import TradeModel from "../models/tradeModel.js";
import kafkaProducer from "../services/kafkaProducer.js";
import { generateSnowflakeId } from "../utils/snowflake.js"
import WebSocketService from "../services/websocketService.js";
import { updatePriceData, logOrderBookSnapshot } from "../services/quoteService.js";
import { logger } from "../app.js";


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
                executedQuantity: order.executed_quantity,
                status: order.status,
                createdAt: order.created_at
            }));

            return res.status(200).json({
                ok: true,
                message: "Orders retrieved successfully",
                orders: formattedOrders
            });
        } catch(error) {
            console.error("[getOrders] error:", error);
            throw error;
        }
    }

    async getOrdersByMarketMaker(ws){
        const userId = ws.userId;

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
                executedQuantity: order.executed_quantity,
                status: order.status,
                createdAt: order.created_at
            }));

            ws.send(JSON.stringify({
                type: "orders",
                message: "Orders retrieved successfully",
                data: {
                    orders:formattedOrders
                }
            }))
        } catch(error) {
            console.error("[getOrdersByMarketMaker] error:", error);
            ws.send(JSON.stringify({ type:"error", message: error.message }));
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
            let authResult;
            if (side === "buy") {
                authResult = await preBuyAuth(userId, price, quantity);
            } else if (side === "sell") {
                authResult = await preSellAuth(userId, symbol, quantity);
            } 
    
            if (!authResult.success) {
                console.log("authResult:", authResult);
                return res.status(400).json({ error: true, message: authResult.message });
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
            const topicSymbol = symbol.replace("_usdt","")
            const topic = `new-order-${topicSymbol}`

     
            // send order to kafka 
            await kafkaProducer.sendMessage(topic, {
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
            
            // sendOrderUpdateToUser
            const newOrder = {
                type: "orderUpdate",
                message: "newOrder",
                data: {
                    message: "newOrder",
                    orderId: order.order_id,
                    symbol: order.symbol,
                    side: order.side,
                    type: order.type,
                    price: order.price,
                    quantity: order.quantity,
                    executedQuantity: order.executed_quantity,
                    status: order.status,
                    createdAt: order.created_at
                }
            };

            sendOrderUpdateToUser(order.user_id, newOrder);
            
            res.status(200).json({
                ok: true,
                message: "Order created successfully",
            })

        } catch(error) {
            const errorMessage = `[createOrder] error: ${error}`
            logger.error(errorMessage);
        }
    }

    
    // router.post("/marketMaker/order", TradeController.createOrder);
    async createOrderByMarketMaker(ws, message) {
        const { symbol, side, type, price, quantity } = message.data;
        const userId = ws.userId;

        if ( !userId || !symbol || !side || !type || !price || !quantity) {
            ws.send(JSON.stringify({ type:"error", message: "Missing required fields" }));
        }

        try { 
            let authResult;
            if (side === "buy") {
                authResult = await preBuyAuth(userId, price, quantity);
            } else if (side === "sell") {
                authResult = await preSellAuth(userId, symbol, quantity);
            } 
    
            if (!authResult.success) {
                ws.send(JSON.stringify({ type: "error", message: authResult.message }));
                return;
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
            const topicSymbol = symbol.replace("_usdt","")
            const topic = `new-order-${topicSymbol}`

        
            // send order to kafka 
            await kafkaProducer.sendMessage(topic, {
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

            const newOrder = {
                type: "orderUpdate",
                message: "newOrder",
                data: {
                    message: "newOrder",
                    orderId: order.order_id,
                    symbol: order.symbol,
                    side: order.side,
                    type: order.type,
                    price: order.price,
                    quantity: order.quantity,
                    executedQuantity: order.executed_quantity,
                    status: order.status,
                    createdAt: order.created_at
                }
            };

            sendOrderUpdateToUser(order.user_id, newOrder);

            ws.send(JSON.stringify({
                type: "orderCreated",
                data: {
                    ok: true,
                    message: "Order created successfully",
                    order: {
                        orderId: order.order_id,
                        symbol: order.symbol,
                        side: order.side,
                        type: order.type,
                        price: order.price,
                        quantity: order.quantity,
                        status: order.status,
                        createdAt: order.created_at
                    }
                }
            }));

        } catch(error) {
            const errorMessage = `[createOrderByMarketMaker] error: ${error}`
            logger.error(errorMessage);
            ws.send(JSON.stringify({ type:"error", message: error.message }));
        }
    }

/////////////////////////  UPDATE ORDER  ///////////////////////////
    // WS broadcast order update
    async updateOrderData(trade_result) {
        const {
            order_id,
            timestamp,
            executed_quantity,
            executed_price,
            status
        } = trade_result;
    
        const updateOrderData = {
            order_id,
            executed_quantity: new Decimal(executed_quantity).toString(),
            executed_price: new Decimal(executed_price).toString(),
            status,
            updated_at: timestamp
        };
    
        try {
            const result = await TradeModel.updateOrderData(updateOrderData);
            if (!result.success) {
                const warnMessage = result
                logger.warn(warnMessage)
                return; // sometimes cancel data is faster than update data
            }

            const resultOrderData = result.data;
    
            // WebSocket 
            const quantity = new Decimal(resultOrderData.quantity);
            const remainingQuantity = new Decimal(resultOrderData.remaining_quantity);
            const filledQuantity = quantity.minus(remainingQuantity).toString();

            const newUpdate = {
                type: "orderUpdate",
                message: "newUpdate",
                data: {
                    message: "newUpdate",
                    orderId: resultOrderData.order_id,
                    averagePrice: resultOrderData.average_price,
                    status: resultOrderData.status,
                    symbol: resultOrderData.symbol,
                    side: resultOrderData.side,
                    price: resultOrderData.price,
                    quantity: resultOrderData.quantity,
                    filledQuantity: filledQuantity,
                    createdAt: resultOrderData.created_at
                }
            };

            await sendOrderUpdateToUser(resultOrderData.user_id,  newUpdate);
        } catch (error) {
            const errorMessage = `[updateOrderData(controller)] error: ${error}`
            logger.error(errorMessage);
        }
    }


    // WS broadcast order book
    async broadcastOrderBookToRoom(orderBookSnapshot, symbol) {
        const rawAsks = orderBookSnapshot.asks.map( order => {
            return [Decimal(order.price).toFixed(2), Decimal(order.quantity).toFixed(5)]
        });
        const rawBids = orderBookSnapshot.bids.map( order => { 
            return [Decimal(order.price).toFixed(2), Decimal(order.quantity).toFixed(5)]})
        const askArray = rawAsks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).slice(-10);
        const bidArray = rawBids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 10);
        const processedData = {
            asks: askArray,
            bids: bidArray
        }

        logOrderBookSnapshot(symbol, processedData);

        try {
            const roomSymbol = `${symbol}_usdt`
            WebSocketService.broadcastToRoom(roomSymbol, {
                type: "orderBook",
                symbol: symbol,
                data: processedData
            }); 
        } catch (error) {
            console.error("[broadcastOrderBookToRoom] error:", error);
            throw error;
        }
    }

    // WS broadcast current trade and time 
    async broadcastRecentTradeToRoom(trade_result, symbol) {
        const { side, executed_price, timestamp, isTaker } = trade_result;
        if (!isTaker) {
            return;
        }

        try {
            const roomSymbol = `${symbol}_usdt`
            WebSocketService.broadcastToRoom(roomSymbol,{
                type: "recentTrade",
                data: {
                    side,
                    price: executed_price,  
                    timestamp
                }});
        } catch (error) {  
            console.error("[broadcastRecentTradeToRoom] error:", error);
            throw error;
        }
    }

/////////////////////////  CANCEL ORDER  ///////////////////////////
    // router.patch("/order", TradeController.cancelOrder);
    async cancelOrder(req, res){
        const { orderId, symbol } = req.body;
        const  userId = req.user.userId;

        if ( !userId || !orderId || !symbol) {
            return res.status(400).json({ error:true, message:"Missing required fields!" })
        }

        const localOrderStatus = await TradeModel.checkCancelOrderStatus(orderId);
        if (localOrderStatus[0].status === "filled") {
            return res.status(401).json({ error: true, message: "Order has been executed" });
        }

        try {
            const topicSymbol = symbol.replace("_usdt", "");
            const topic = `cancel-order-${topicSymbol}`
            await kafkaProducer.sendMessage(topic, { orderId, userId, symbol });
            
            res.status(200).json({ ok: true, message: "Order cancellation request sent" });
        } catch(error) {
            console.error("[cancelOrder] error:", error);
            throw error;
        }
    }

    async cancelOrderByMarketMaker(ws, message) {
        const { orderId, symbol } = message.data;
        const userId = ws.userId;

        if ( !userId || !orderId || !symbol) {
            ws.send(JSON.stringify({ type: "error", message: "Missing required fields!" }));
        }

        try {
            const localOrderStatus = await TradeModel.checkCancelOrderStatus(orderId);
            if (localOrderStatus[0].status === "filled") {
                ws.send(JSON.stringify({ type: "error", message: "Order cancellation request sent" }));
                return;
            }

            const topicSymbol = symbol.replace("_usdt", "")
            const topic = `cancel-order-${topicSymbol}`
            await kafkaProducer.sendMessage(topic, { orderId, userId, symbol });

        } catch (error) {
            const errorMessage = `[cancelOrderByMarketMaker] error:, ${error}`
            logger.error(errorMessage);
            ws.send(JSON.stringify({ type: "error", message: error.message }));
        }

    }

    async handleCancelResult(cancelResult) {
        const { order_id: orderId, user_id: userId } = cancelResult;
        try {
            if (cancelResult.status === "NOT_FOUND") {
                const checkStatus = await TradeModel.checkCancelOrderStatus(orderId);
                if (checkStatus[0].status === "filled") {
                    console.log(`Order ${orderId} already executed, cannot cancel.`);
                    return; 
                }
                console.log(`Order ${orderId} not found, possibly already cancelled.`);
                return; 
            }
    
            const updateResult = await TradeModel.cancelOrder(orderId, cancelResult.status, cancelResult.timestamp);
    
            if (!updateResult) {
                console.error(`Unexpected cancellation result for order ${orderId}:`, cancelResult.status);
                return; 
            }
    
            if (cancelResult.side === "buy") {
                await TradeModel.releaseLockedBalance(cancelResult);
            } else {
                await TradeModel.releaseLockedAsset(cancelResult);
            }
    
            if (updateResult.updateStatus === "CANCELED" || updateResult.updateStatus === "PARTIALLY_FILLED_CANCELED") {
                const cancelMessage = {
                    type: "orderUpdate",
                    message: "Order cancelled",
                    data: {
                        orderId: updateResult.updateOrderId,
                        status: updateResult.updateStatus,
                    }
                };

                WebSocketService.sendToUser(userId, cancelMessage);
                console.log(`Order ${orderId} cancelled successfully. Status: ${updateResult.updateStatus}`);
            }
        } catch(error) {
            const errorMessage = `[handleCancelResult] error for order ${orderId}: error.sqlMessage`  
            logger.error(errorMessage);
            ws.send(JSON.stringify({ type:"error", message: error.message }));
            return;
        }
    }
    

/////////////////////////  TRADE HISTORY  ///////////////////////////
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
            const formattedSymbol = symbol.toUpperCase().replace("_", "");
            updatePriceData(formattedSymbol, executed_price);
        } catch(error) {
            console.error("[createTradeHistory(controller)] error:", error);
            return;
        }
    }


}


export default new TradeController();


async function preBuyAuth(userId, price, quantity) {
    const dPrice = new Decimal(price);
    const dQuantity = new Decimal(quantity);
    const costAmount = dPrice.times(dQuantity);  

    try {
        const availableBalance = await TradeModel.getAvailableBalanceById(userId);
        const usableBalance = new Decimal(availableBalance);
        if (usableBalance.lessThan(costAmount)) {
            return {
                success: false,
                message: "INSUFFICIENT AVAILABLE BALANCE"
            };
        } 
        await TradeModel.lockBalance(userId, price, quantity);
        return { success: true };
    } catch (error) {
        console.error("preBuyAuth error:", error);
        return {
            success: false,
            message: "An error occurred while processing the buy order"
        };
    } 
}


async function preSellAuth(userId, symbol, quantity) {
    const sellQuantity = new Decimal(quantity);
    try {
        const availableQuantity = await TradeModel.getQuantityBySymbolAndUserId(userId, symbol);
        const dAvailableQuantity = new Decimal(availableQuantity);
        if (dAvailableQuantity.lessThan(sellQuantity)) {
            return {
                success: false,
                message: "INSUFFICIENT AVAILABLE ASSET"
            };
        }
        await TradeModel.lockAsset(userId, symbol, quantity);
        return { success: true };
    } catch (error) {
        console.error("preSellAuth error:", error);
        return {
            success: false,
            message: "An error occurred while processing the sell order"
        };
    }
}



async function sendOrderUpdateToUser(user_id, orderMessage) {
    try {
        WebSocketService.sendToUser(user_id, orderMessage);
    } catch (error) {
        console.error("Error sending order update to user:", error);
    }
}

// async function sendOrderUpdateToUser(resultOrderData, filledQuantity) {
//     try {
//         const message = {
//             type: "orderUpdate",
//             data: {
//                 orderId: resultOrderData.order_id,
//                 filledQuantity: filledQuantity,
//                 averagePrice: resultOrderData.average_price,
//                 status: resultOrderData.status,
//                 symbol: resultOrderData.symbol,
//                 side: resultOrderData.side,
//                 price: resultOrderData.price,
//                 quantity: resultOrderData.quantity,
//                 createdAt: resultOrderData.created_at
//             }
//         };
//         WebSocketService.sendToUser(resultOrderData.user_id, message);
//     } catch (error) {
//         console.error("Error sending order update to user:", error);
//     }
// }