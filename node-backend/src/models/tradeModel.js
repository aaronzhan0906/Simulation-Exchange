import db from "../config/database.js";
import Decimal from 'decimal.js';

class TradeModel {
///////////////////// GET ORDERS //////////////////////////
    async getOrders(userId) {
        const connection = await db.getConnection();

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
            console.error("Error in getOrders:", error);
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
    
        await db.query(insertQuery, [
            order_id, user_id, symbol, side, type, price, quantity, status
        ]);
        const selectQuery = `
        SELECT * FROM orders WHERE order_id = ?
        `;
    
        const rows = await db.query(selectQuery, [order_id]);
        return rows[0];
    }

///////////////////////// cancel order //////////////////////////
    async cancelOrder(orderId, status, updatedAt) {
        const updateOrderId = orderId;
        const updateStatus = status;
        const updateUpdatedAt = updatedAt;
        try {
            const result = await db.query(
                `UPDATE orders
                SET status = ?,
                updated_at = ?
                WHERE order_id = ?`,
                [updateStatus, updateUpdatedAt, updateOrderId]
            );
            if (result.affectedRows > 0) {
                return { updateOrderId, updateStatus, updateUpdatedAt };}
        } catch (error) {
            console.error("Error in cancelOrder:", error);
            throw error;
        }
    }

    async releaseLockedBalance (cancelResult){
        const userId = cancelResult.user_id;
        const updatePrice = new Decimal(cancelResult.price);
        const updateQuantity = new Decimal(cancelResult.canceled_quantity);
        const updateAmount = updatePrice.times(updateQuantity);
        try {
            const result = await db.query(
                `UPDATE accounts
                SET locked_balance = locked_balance - ?
                WHERE user_id = ?`,
                [updateAmount.toString(), userId]
            );
        

        if (result.affectedRows > 0) {
            return true;
        }

    } catch (error) {
        console.error("Error in releaseLockedBalance:", error);
        throw error;
        }
    }

    async releaseLockedAsset (cancelResult){
        const userId = cancelResult.user_id;
        const updateSymbol = cancelResult.symbol.replace("_usdt","");
        const updateQuantity = new Decimal(cancelResult.canceled_quantity);

        try {
            const result = await db.query(
                `UPDATE assets
                SET locked_quantity = locked_quantity - ?
                WHERE user_id = ? AND symbol = ?`,
                [updateQuantity.toString(), userId, updateSymbol]
            );
            if (result.affectedRows > 0) {
                return true;
            }
        } catch (error) {
            console.error("Error in releaseLockedAsset:", error);
            throw error;
        }
    }


////////////////////////// trade history //////////////////////////
    async createTradeHistory(tradeData) {
        const insertQuery = `
            INSERT INTO trades 
            (user_id, trade_id, executed_at, symbol, side, price, quantity, buyer_user_id, buyer_order_id, seller_user_id, seller_order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    
        try {
            await db.query(insertQuery, [
                tradeData.user_id, tradeData.trade_id, tradeData.executed_at, tradeData.symbol, tradeData.side, tradeData.price, tradeData.quantity, 
                tradeData.buyer_user_id, tradeData.buyer_order_id, tradeData.seller_user_id, tradeData.seller_order_id
            ]);
        } catch (error) {
            console.error("Error creating trade history:", error);
            throw error;
        }
    }
    
///////////////////////// PREAUTH //////////////////////////
    async getAvailableBalanceById(userId) {
        const [result] = await db.query(
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

        await db.query(
            `UPDATE accounts
            SET locked_balance = locked_balance + ?
            WHERE user_id = ?
            `,[constAmount.toString(), userId]
        )
    }

    async getQuantityBySymbolAndUserId(userId, symbol){
        const updateSymbol = symbol.replace("_usdt","");
        const [result] = await db.query(
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
        await db.query(
            `UPDATE assets
            SET locked_quantity = locked_quantity + ?
            WHERE user_id = ? AND symbol = ?
            `,[quantity, userId, updateSymbol]
        )
    }



///////////////////////// UPDATE ORDER //////////////////////////
// main logic
    async updateOrderData(updateOrderData) {
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 獲取全局鎖
            await connection.query('SELECT GET_LOCK("trade_lock", 10) as lock_result');

            // 使用 FOR UPDATE 鎖定訂單記錄
            const [[oldData]] = await connection.query(
                `SELECT quantity, executed_quantity, remaining_quantity, average_price
                FROM orders
                WHERE order_id = ? FOR UPDATE`,
                [updateOrderData.order_id]
            );

            if (!oldData) {
                throw new Error(`Order not found: ${updateOrderData.order_id}`);
            }

            // 計算新的數據
            const old = {
                quantity: new Decimal(oldData.quantity || 0),
                executed_quantity: new Decimal(oldData.executed_quantity || 0),
                remaining_quantity: new Decimal(oldData.remaining_quantity || 0),
                average_price: new Decimal(oldData.average_price || 0)
            };

            const newExecutedQuantity = old.executed_quantity.plus(updateOrderData.executed_quantity);
            const oldTotal = old.average_price.times(old.executed_quantity);
            const newTotal = new Decimal(updateOrderData.executed_price).times(updateOrderData.executed_quantity);
            const allTotal = oldTotal.plus(newTotal);

            if (newExecutedQuantity.isZero()) {
                throw new Error("New executed quantity cannot be zero");
            }

            const newAveragePrice = allTotal.dividedBy(newExecutedQuantity);

            if (newAveragePrice.isNaN() || !newAveragePrice.isFinite()) {
                throw new Error("Invalid average price calculation result");
            }

            // 更新訂單
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

            // 獲取更新後的訂單數據
            const [[resultOrderData]] = await connection.query(
                `SELECT * FROM orders WHERE order_id = ?`,
                [updateOrderData.order_id]
            );
      
            const executedQty = updateOrderData.executed_quantity;

            if (resultOrderData.side === "buy") {
                await this.increaseAsset(connection, resultOrderData, executedQty);
                await this.decreaseBalance(connection, resultOrderData, executedQty);
                await this.unlockBalance(connection, resultOrderData, executedQty);
            } else {
                await this.decreaseAsset(connection, resultOrderData, executedQty);
                await this.increaseBalance(connection, resultOrderData, executedQty);
                await this.unlockAsset(connection, resultOrderData, executedQty);
            }

            await connection.commit();
            return resultOrderData;
        } catch (error) {
            await connection.rollback();
            console.error("Error in updateOrderData:", error);
            throw error;
        } finally {
            // 釋放全局鎖
            await connection.query('SELECT RELEASE_LOCK("trade_lock") as release_result');
            connection.release();
        }
    }

    async decreaseBalance(connection, updateAccountData, executedQty) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const executedPrice = new Decimal(updateAccountData.average_price);
        const decreaseAmount = executedQuantity.times(executedPrice);
    
        console.log(`[decreaseBalance] Start: User ${updateUserId}, ExecutedQty: ${executedQuantity}, ExecutedPrice: ${executedPrice}, DecreaseAmount: ${decreaseAmount}`);
    
        try {
            const [[beforeBalance]] = await connection.query(
                'SELECT balance, locked_balance FROM accounts WHERE user_id = ? FOR UPDATE',
                [updateUserId]
            );
            console.log(`[decreaseBalance] Before update - Balance: ${beforeBalance.balance}, LockedBalance: ${beforeBalance.locked_balance}`);
    
            const [result] = await connection.query(
                `UPDATE accounts 
                SET balance = balance - ? 
                WHERE user_id = ?`,
                [decreaseAmount.toString(), updateUserId]
            );
    
            const [[afterBalance]] = await connection.query(
                'SELECT balance, locked_balance FROM accounts WHERE user_id = ?',
                [updateUserId]
            );
            console.log(`[decreaseBalance] After update - Balance: ${afterBalance.balance}, LockedBalance: ${afterBalance.locked_balance}`);
    
            console.log(`[decreaseBalance] Result: AffectedRows: ${result.affectedRows}, ChangedRows: ${result.changedRows}`);
            console.log(`[decreaseBalance] Completed: Decreased balance for user ${updateUserId} by ${decreaseAmount}`);
        } catch (error) {
            console.error(`[decreaseBalance] Error: ${error.message}`);
            throw error;
        }
    }
    
    async increaseBalance(connection, updateAccountData, executedQty) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const executedPrice = new Decimal(updateAccountData.average_price);
        const increaseAmount = executedQuantity.times(executedPrice);
    
        await connection.query(
            "UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
            [increaseAmount.toString(), updateUserId]
        );
        console.log(`Increased balance for user ${updateUserId} by ${increaseAmount}`);
    }
    
    async unlockBalance(connection, updateAccountData, executedQty) {
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(executedQty);
        const executedPrice = new Decimal(updateAccountData.average_price);
        const unlockAmount = executedQuantity.times(executedPrice);
    
        console.log(`[unlockBalance] Start: User ${updateUserId}, ExecutedQty: ${executedQuantity}, ExecutedPrice: ${executedPrice}, UnlockAmount: ${unlockAmount}`);
    
        try {
            const [[beforeBalance]] = await connection.query(
                'SELECT balance, locked_balance FROM accounts WHERE user_id = ? FOR UPDATE',
                [updateUserId]
            );
            console.log(`[unlockBalance] Before update - Balance: ${beforeBalance.balance}, LockedBalance: ${beforeBalance.locked_balance}`);
    
            const [result] = await connection.query(
                `UPDATE accounts
                SET locked_balance = locked_balance - ?
                WHERE user_id = ?`,
                [unlockAmount.toString(), updateUserId]
            );
    
            const [[afterBalance]] = await connection.query(
                'SELECT balance, locked_balance FROM accounts WHERE user_id = ?',
                [updateUserId]
            );
            console.log(`[unlockBalance] After update - Balance: ${afterBalance.balance}, LockedBalance: ${afterBalance.locked_balance}`);
    
            console.log(`[unlockBalance] Result: AffectedRows: ${result.affectedRows}, ChangedRows: ${result.changedRows}`);
            console.log(`[unlockBalance] Completed: Unlocked balance for user ${updateUserId}: ${unlockAmount}`);
        } catch (error) {
            console.error(`[unlockBalance] Error: ${error.message}`);
            throw error;
        }
    }
    
    async increaseAsset(connection, updateAssetData, executedQty) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("_usdt","");
        const executedQuantity = new Decimal(executedQty);
        const executedPrice = new Decimal(updateAssetData.average_price);

        console.log(`Starting increaseAsset for user ${updateUserId}, symbol ${updateSymbol}, quantity ${executedQuantity}, price ${executedPrice}`);

        try {
            const [[existingAsset]] = await connection.query(
                `SELECT quantity, average_price, locked_quantity
                FROM assets
                WHERE user_id = ? AND symbol = ? FOR UPDATE`,
                [updateUserId, updateSymbol]
            );

            console.log(`Existing asset data:`, existingAsset);

            let newQuantity, newAveragePrice;

            if (existingAsset) {
                const currentQuantity = new Decimal(existingAsset.quantity);
                const currentAveragePrice = new Decimal(existingAsset.average_price);
                const currentLockedQuantity = new Decimal(existingAsset.locked_quantity);

                console.log(`Current quantity: ${currentQuantity}, average price: ${currentAveragePrice}, locked quantity: ${currentLockedQuantity}`);

                newQuantity = currentQuantity.plus(executedQuantity);
                const totalValue = currentQuantity.times(currentAveragePrice).plus(executedQuantity.times(executedPrice));
                newAveragePrice = totalValue.dividedBy(newQuantity);

                console.log(`New quantity: ${newQuantity}, new average price: ${newAveragePrice}`);

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
                console.log(`No existing asset found, creating new entry`);
                newQuantity = executedQuantity;
                newAveragePrice = executedPrice;

                await connection.query(
                    `INSERT INTO assets (user_id, symbol, quantity, average_price)
                    VALUES (?, ?, ?, ?)`,
                    [updateUserId, updateSymbol, newQuantity.toString(), newAveragePrice.toString()]
                );
            }

            console.log(`Asset increase completed. New quantity: ${newQuantity}, new average price: ${newAveragePrice}`);

            // 驗證更新後的資產數據
            const [[updatedAsset]] = await connection.query(
                `SELECT quantity, average_price, locked_quantity
                FROM assets
                WHERE user_id = ? AND symbol = ?`,
                [updateUserId, updateSymbol]
            );

            console.log(`Updated asset data:`, updatedAsset);

            if (!updatedAsset || 
                new Decimal(updatedAsset.quantity).minus(newQuantity).abs().greaterThan(0.00000001) || 
                new Decimal(updatedAsset.average_price).minus(newAveragePrice).abs().greaterThan(0.00000001)) {
                throw new Error(`Asset update verification failed. Expected: quantity=${newQuantity}, average_price=${newAveragePrice}. Actual: ${JSON.stringify(updatedAsset)}`);
            }

        } catch (error) {
            console.error(`Error in increaseAsset for user ${updateUserId}, symbol ${updateSymbol}:`, error);
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
    
        await connection.query(
            `UPDATE assets
            SET quantity = ?
            WHERE user_id = ? AND symbol = ?`,
            [newQuantity.toString(), updateUserId, updateSymbol]
        );
        console.log(`Decreased asset for user ${updateUserId}: ${updateSymbol} by ${updateAssetData.executed_quantity}`);
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
        console.log(`Unlocked asset for user ${updateUserId}: ${updateSymbol} by ${updateAssetData.executed_quantity}`);
    }

}

export default new TradeModel();