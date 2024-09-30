import pool from "../config/database.js";
import Decimal from 'decimal.js';
import { logger } from "../app.js";
import { formatErrorDetails } from "../utils/formattedError.js";


class TradeModel {
///////////////////// GET ORDERS //////////////////////////
    logError(methodName, error) {
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        };
        logger.error(`[${methodName}] Error:\n${formatErrorDetails(errorDetails)}`);
    }


    async getOrders(userId) {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.query(
                `SELECT * FROM orders 
                WHERE user_id = ?
                AND status IN ("open", "partially_filled")
                ORDER BY created_at ASC`,
                userId
            );
            
            return result;
        } catch(error) {
            this.logError("getOrders", error);
            throw error
        } finally {
            connection.release();
        }
    }
    

///////////////////////// CREATE ORDER //////////////////////////
    async createOrder(order_id, user_id, symbol, side, type, price, quantity, status) {
        const insertQuery = `
        INSERT INTO orders 
        (order_id, user_id, symbol, side, type, price, quantity, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
    
        await pool.query(insertQuery, [
            order_id, user_id, symbol, side, type, price, quantity, status
        ]);
        const selectQuery = `
        SELECT * FROM orders WHERE order_id = ?
        `;
    
        const rows = await pool.query(selectQuery, [order_id]);
        return rows[0];
    }

///////////////////////// CANCEL ORDER //////////////////////////
    async cancelOrder(orderId, status, updatedAt) {
        const updateOrderId = orderId;
        const updateStatus = status;
        const updateUpdatedAt = updatedAt;
        if (updateStatus === "NOT FOUND") {
            const warningMessage = `Order ${updateOrderId} not found in matching engine`;
            logger.warn(warningMessage);
            return
        }

        try {
            const result = await pool.query(
                `UPDATE orders
                SET status = ?,
                updated_at = ?
                WHERE order_id = ?`,
                [updateStatus, updateUpdatedAt, updateOrderId]
            );
            if (result.affectedRows > 0) {
                return { updateOrderId, updateStatus, updateUpdatedAt };}
        } catch (error) {
            this.logError("cancelOrder", error);
            throw error;
        }
    }

    async releaseLockedBalance (cancelResult){
        const userId = cancelResult.user_id;
        const updatePrice = new Decimal(cancelResult.price);
        const updateQuantity = new Decimal(cancelResult.canceled_quantity);
        const updateAmount = updatePrice.times(updateQuantity);
        try {
            const result = await pool.query(
                `UPDATE accounts
                SET locked_balance = locked_balance - ?
                WHERE user_id = ?`,
                [updateAmount.toString(), userId]
            );
        

        if (result.affectedRows > 0) {
            return true;
        }

    } catch (error) {
        this.logError("releaseLockedBalance", error);
        throw error;
        }
    }

    async releaseLockedAsset (cancelResult){
        const userId = cancelResult.user_id;
        const updateSymbol = cancelResult.symbol.replace("_usdt","");
        const updateQuantity = new Decimal(cancelResult.canceled_quantity);

        try {
            const result = await pool.query(
                `UPDATE assets
                SET locked_quantity = locked_quantity - ?
                WHERE user_id = ? AND symbol = ?`,
                [updateQuantity.toString(), userId, updateSymbol]
            );
            if (result.affectedRows > 0) {
                return true;
            }
        } catch (error) {
            this.logError("releaseLockedAsset", error);
            throw error;
        }
    }

    checkCancelOrderStatus(orderId){
        try {
            const result = pool.query(
                `SELECT status FROM orders
                WHERE order_id = ?`,
                [orderId]
            );
            return result;
        } catch (error) {
            this.logError("checkCancelOrderStatus", error);
            throw error;
        }
    }


////////////////////////// trade history //////////////////////////
    async createTradeHistory(tradeData) {
        const insertQuery = `
            INSERT INTO trades 
            (trade_id, executed_at, symbol, side, price, quantity, buyer_user_id, buyer_order_id, seller_user_id, seller_order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    
        try {
            await pool.query(insertQuery, [
                tradeData.trade_id, tradeData.executed_at, tradeData.symbol, tradeData.side, tradeData.price, tradeData.quantity, 
                tradeData.buyer_user_id, tradeData.buyer_order_id, tradeData.seller_user_id, tradeData.seller_order_id
            ]);
        } catch (error) {
            this.logError("createTradeHistory", error);
            throw error;
        }
    }
    
///////////////////////// PREAUTH //////////////////////////
    async getAvailableBalanceById(userId) {
        const [result] = await pool.query(
            `SELECT available_balance 
            FROM accounts 
            WHERE user_id = ?`,
            [userId]
        );
        if (result === undefined) {
            return 0;
        }
        return result.available_balance
    }

    async lockBalance(userId, price, quantity){
        const dPrice = new Decimal(price)
        const dQuantity = new Decimal(quantity)
        const constAmount = dPrice.times(dQuantity)

        await pool.query(
            `UPDATE accounts
            SET locked_balance = locked_balance + ?
            WHERE user_id = ?
            `,[constAmount.toString(), userId]
        )
    }

    async getQuantityBySymbolAndUserId(userId, symbol){
        const updateSymbol = symbol.replace("_usdt","");
        const [result] = await pool.query(
            `SELECT available_quantity 
            FROM assets 
            WHERE user_id = ? AND symbol = ?
            `,[userId, updateSymbol]);
        if (result === undefined) {
            return 0;
        }
        return result.available_quantity;
    }

    async lockAsset(userId, symbol, quantity){
        const updateSymbol = symbol.replace("_usdt","");
        await pool.query(
            `UPDATE assets
            SET locked_quantity = locked_quantity + ?
            WHERE user_id = ? AND symbol = ?
            `,[quantity, userId, updateSymbol]
        )
    }



///////////////////////// UPDATE ORDER //////////////////////////
// main logic
    async updateOrderData(updateOrderData, user_id) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // user 
            await connection.query('SELECT GET_LOCK("?", 10) as lock_result',[`user_trade_lock_${user_id}`]);
            console.log(`Acquired lock: user_trade_lock_${user_id}`);
            // use FOR UPDATE to lock the row
            const [[oldData]] = await connection.query(
                `SELECT quantity, executed_quantity, remaining_quantity, average_price, price
                FROM orders
                WHERE order_id = ? FOR UPDATE`,
                [updateOrderData.order_id]
            );

            if (!oldData) {
                await connection.rollback();
                return {
                    success: false,
                    message: `Order not found: ${updateOrderData.order_id}`,
                };
            }

            if (oldData.status === "CANCELED" || oldData.status === "PARTIALLY_FILLED_CANCELED") {
                await connection.rollback();
                return {
                    success: false,
                    orderId: oldData.order_id,
                    message: "Cannot update order with status CANCELED or PARTIALLY_FILLED_CANCELED",
                }
            }

            // calculate new order data
            const old = {
                quantity: new Decimal(oldData.quantity || 0),
                executed_quantity: new Decimal(oldData.executed_quantity || 0),
                remaining_quantity: new Decimal(oldData.remaining_quantity || 0),
                average_price: new Decimal(oldData.average_price || 0),
                price: new Decimal(oldData.price || 0)
            };

            const newExecutedQuantity = old.executed_quantity.plus(updateOrderData.executed_quantity);
            const oldTotal = old.average_price.times(old.executed_quantity);
            const newTotal = new Decimal(updateOrderData.executed_price).times(updateOrderData.executed_quantity);
            const allTotal = oldTotal.plus(newTotal);

            if (newExecutedQuantity.isZero()) {
                await connection.rollback();
                return {
                    success: false,
                    message: "Executed quantity cannot be zero",
                }
            }

            const newAveragePrice = allTotal.dividedBy(newExecutedQuantity);

            if (newAveragePrice.isNaN() || !newAveragePrice.isFinite()) {
                await connection.rollback();
                return {
                    success: false,
                    message: "Invalid average price calculation result",
                }
            }

            // update order data
            await connection.query(
                `UPDATE orders
                SET executed_quantity = ?,
                    average_price = ?,
                    status = ?,
                    updated_at = ?
                WHERE order_id = ?`,
                [newExecutedQuantity.toString(),
                newAveragePrice.toString(),
                updateOrderData.status,
                updateOrderData.updated_at,
                updateOrderData.order_id]
            );

            // get result order data after update
            const [[resultOrderData]] = await connection.query(
                `SELECT * FROM orders WHERE order_id = ?`,
                [updateOrderData.order_id]
            );
      
            const executedQty = updateOrderData.executed_quantity;
            const executedPrice = updateOrderData.executed_price;
            if (resultOrderData.side === "buy") {
                await this.increaseAsset(connection, resultOrderData, executedQty, executedPrice);
                await this.unlockBalance(connection, resultOrderData, executedQty, old.price);
                await this.decreaseBalance(connection, resultOrderData, executedQty, executedPrice);
            } else {
                await this.increaseBalance(connection, resultOrderData, executedQty, executedPrice);
                await this.unlockAsset(connection, resultOrderData, executedQty);
                await this.decreaseAsset(connection, resultOrderData, executedQty);
            }

            await connection.commit();
            return { success: true, data: resultOrderData };
        } catch (error) {
            await connection.rollback(); // 
            console.log(`[updateOrderData(model)] ${error}`);
            this.logError(`updateOrderData(model) ${error}` );
            return { success: false, message: error.message || "Already CANCELED and rollback" };
        } finally {
            // release lock
            await connection.query('SELECT RELEASE_LOCK(?) as release_result', [`user_trade_lock_${user_id}`]);
            console.log(`Released lock: user_trade_lock_${user_id}`);
            connection.release();
        }
    }

    async decreaseBalance(connection, updateAccountData, executedQty, executedPrice) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const decreaseAmount = executedQuantity.times(executedPrice);
    
        try {
            const [result] = await connection.query(
                `UPDATE accounts 
                SET balance = balance - ? 
                WHERE user_id = ?`,
                [decreaseAmount.toString(), updateUserId]
            );
            if (result.affectedRows === 0) {
                throw new Error(`Failed to decrease balance for user ${updateUserId}`);
            }
        
        } catch (error) {
            logger.error(`[decreaseBalance] Error: ${error}`);
            throw error;
        }
    }
    
    async increaseBalance(connection, updateAccountData, executedQty, executedPrice) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const increaseAmount = executedQuantity.times(executedPrice);
        try{
            const [result] = await connection.query(
                "UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
                [increaseAmount.toString(), updateUserId]
            );
            if (result.affectedRows === 0) {
                throw new Error(`Failed to increase balance for user ${updateUserId}`);
            }
        } catch (error) {
            logger.error(`[increaseBalance] Error: ${error}`);
            throw error;
        }
    }
    
    async unlockBalance(connection, updateAccountData, executedQty, originalPrice) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const unlockAmount = executedQuantity.times(originalPrice);
    
    
        try {
            const [result] = await connection.query(
                `UPDATE accounts
                SET locked_balance = locked_balance - ?
                WHERE user_id = ?`,
                [unlockAmount.toString(), updateUserId]
            );
    
            if (result.affectedRows === 0) {    
                throw new Error(`Failed to unlock balance for user ${updateUserId}`);
            }
        } catch (error) {
            logger.error(`[unlockBalance] Error: ${error}`);
            throw error;
        }
    }
    
    async increaseAsset(connection, updateAssetData, executedQty, executedP) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("_usdt","");
        const executedQuantity = new Decimal(executedQty);
        const executedPrice = new Decimal(executedP);


        try {
            const [[existingAsset]] = await connection.query(
                `SELECT quantity, average_price, locked_quantity
                FROM assets
                WHERE user_id = ? AND symbol = ? FOR UPDATE`,
                [updateUserId, updateSymbol]
            );


            if (existingAsset) {
                const currentQuantity = new Decimal(existingAsset.quantity);
                const currentAveragePrice = new Decimal(existingAsset.average_price);

                const newQuantity = currentQuantity.plus(executedQuantity);
                const currentTotalValue = currentQuantity.times(currentAveragePrice);
                const newValue = executedQuantity.times(executedPrice);
                const totalValue = currentTotalValue.plus(newValue);
                const newAveragePrice = totalValue.dividedBy(newQuantity);

                if (newQuantity.isNegative() || newAveragePrice.isNegative()) {
                    throw new Error(`Invalid calculation result: newQuantity=${newQuantity}, newAveragePrice=${newAveragePrice}`);
                }

                await connection.query(
                    `UPDATE assets
                    SET quantity = ?, average_price = ?
                    WHERE user_id = ? AND symbol = ?`,
                    [newQuantity.toString(), newAveragePrice.toString(), updateUserId, updateSymbol]
                );
            } else {
                // Create new asset if not exists when first buy
                const initQuantity = executedQuantity;
                const initAveragePrice = executedPrice;

                await connection.query(
                    `INSERT INTO assets (user_id, symbol, quantity, average_price)
                    VALUES (?, ?, ?, ?)`,
                    [updateUserId, updateSymbol, initQuantity.toString(), initAveragePrice.toString()]
                );
            }
        } catch (error) {
            logger.error(`Error in increaseAsset for user ${updateUserId}, symbol ${updateSymbol} Error:${error}`);
            throw error;
        }
    }
    
    async decreaseAsset(connection, updateAssetData, executedQty) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("_usdt","");
    
        const [[existingAsset]] = await connection.query(
            `SELECT quantity
            FROM assets
            WHERE user_id = ? AND symbol = ? FOR UPDATE`,
            [updateUserId, updateSymbol]
        );
    
        if (!existingAsset) {
            throw new Error(`Asset not found for user ${updateUserId} and symbol ${updateSymbol}`);
        }
    
        const currentQuantity = new Decimal(existingAsset.quantity);
        const newQuantity = currentQuantity.minus(executedQty);
    
        if (newQuantity.isNegative()) {
            throw new Error(`Insufficient asset quantity for user ${updateUserId} and symbol ${updateSymbol}`);
        }

        // delete asset if quantity is zero for recalculate average price
        if (newQuantity.isZero()){
            await connection.query(
                `DELETE FROM assets
                WHERE user_id = ? AND symbol = ?`,
                [updateUserId, updateSymbol]
            );
            return;
        }
    
        await connection.query(
            `UPDATE assets
            SET quantity = ?
            WHERE user_id = ? AND symbol = ?`,
            [newQuantity.toString(), updateUserId, updateSymbol]
        );
    }
    
    async unlockAsset(connection, updateAssetData, executedQty) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("_usdt","");
    
        await connection.query(
            `UPDATE assets
            SET locked_quantity = locked_quantity - ?
            WHERE user_id = ? AND symbol = ?`,
            [executedQty, updateUserId, updateSymbol]
        );
    }

}

export default new TradeModel();