import db from "../config/database.js";
import Decimal from 'decimal.js';

class TradeModel {
    // order feature
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

    async updateOrderData(updateOrderData) {
        const newData = updateOrderData

        try {
            const oldData = await db.query(
                `SELECT quantity, executed_quantity, remaining_quantity, average_price
                FROM orders
                WHERE order_id = ?`,
                [newData.order_id]
            )

           
            // calculate logic
            const old = {
                quantity: new Decimal(oldData.quantity || 0),
                executed_quantity: new Decimal(oldData.executed_quantity || 0),
                remaining_quantity: new Decimal(oldData.remaining_quantity || 0),
                average_price: new Decimal(oldData.average_price || 0)
            };
            
            const newExecutedQuantity = new Decimal(old.executed_quantity).plus(newData.executed_quantity);
            const newRemainingQuantity = new Decimal(old.quantity).minus(newData.executed_quantity);
            const oldValue = new Decimal(old.average_price).times(old.executed_quantity);
            const newValue = new Decimal(newData.executed_price).times(newData.executed_quantity);
            const totalQuantity = new Decimal(old.quantity).minus(newRemainingQuantity);
            const newAveragePrice = oldValue.plus(newValue).dividedBy(totalQuantity);
            await db.query(
                `UPDATE orders
                SET executed_quantity = ?,
                average_price = ?,
                status = ?,
                updated_at = ?
                WHERE order_id = ?
            `, [newExecutedQuantity.toString(),
                newAveragePrice.toString(),
                newData.status,
                newData.updated_at,
                newData.order_id]);

            const resultOrderData = await db.query(
                `SELECT * FROM orders WHERE order_id = ?`,[newData.order_id]
            )
            return resultOrderData[0]
        } catch (error) {
        console.error("Error in updateOrderData:", error);
        throw error;
        }
    }

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
    
    // preauth
    async getAvailableBalanceById(userId) {
        const result = await db.query(
            `SELECT available_balance 
            FROM accounts 
            WHERE user_id = ?`,
            [userId]
        );
        return result[0].available_balance
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

    async getQuantityBySymbolAndUserId(userId, symbol,){
        const updateSymbol = symbol.replace("/USDT","");
        const result = await db.query(
            `SELECT available_quantity 
            FROM assets 
            WHERE user_id = ? AND symbol = ?
            `,[userId, updateSymbol]);
        return result[0].available_quantity;
    }

    async lockAsset(userId, symbol, quantity){
        const updateSymbol = symbol.replace("/USDT","");
        console.log(updateSymbol)
        await db.query(
            `UPDATE assets
            SET locked_quantity = locked_quantity + ?
            WHERE user_id = ? AND symbol = ?
            `,[quantity, userId, updateSymbol]
        )
    }

    // async releaseLockAsset(userId, symbol, quantity){
    //     console.log("releaseLockAsset")
    // }


    // calculate balance and assets
    async decreaseBalance(updateAccountData){
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(updateAccountData.executed_quantity)
        const executedPrice = new Decimal(updateAccountData.average_price);
        const decreaseAmount = executedQuantity.times(executedPrice)
        try {
            await db.query(
                `UPDATE accounts 
                SET balance = balance - ? 
                WHERE user_id = ?`,
                [decreaseAmount.toString(), updateUserId]
            );
        }  catch (error) {
            console.error("Error decreasing balance:", error);
            throw error;
        }
    }

    async increaseBalance(updateAccountData){
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(updateAccountData.executed_quantity)
        const executedPrice = new Decimal(updateAccountData.average_price);
        const increaseAmount = executedQuantity.times(executedPrice)
        try {
            await db.query(
                "UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
                [increaseAmount.toString(), updateUserId]
            );
        }  catch (error) {
            console.error("Error decreasing balance:", error);
            throw error;
        }
    }

    async unlockBalance(updateAccountData){
        const updateUserId = updateAccountData.user_id;
        const executedQuantity = new Decimal(updateAccountData.executed_quantity)
        const executedPrice = new Decimal(updateAccountData.average_price);
        const unlockAmount = executedQuantity.times(executedPrice)
        try {
            await db.query(
                `UPDATE accounts
                SET locked_balance = locked_balance - ?
                WHERE user_id = ?`,
                [unlockAmount.toString(), updateUserId]
            );
        } catch (error) {
            console.error("Error unlocking balance:", error);
            throw error;
        }
    }


    async increaseAsset(updateAssetData) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("/USDT","");
        try {
            const existingAsset = await db.query(
                `SELECT quantity, average_price
                FROM assets
                WHERE user_id = ? AND symbol = ?`,
                [updateUserId, updateSymbol]
            );

            let newQuantity, newAveragePrice;
            
            if (existingAsset.length > 0) {
                const currentQuantity = new Decimal(existingAsset[0].quantity);
                const currentAveragePrice = new Decimal(existingAsset[0].average_price);
                const executedQuantity = new Decimal(updateAssetData.executed_quantity);
                const executedPrice = new Decimal(updateAssetData.average_price);
            
                newQuantity = currentQuantity.plus(executedQuantity);
                newAveragePrice = currentQuantity.times(currentAveragePrice).plus(executedQuantity.times(executedPrice)).dividedBy(newQuantity);

                await db.query(
                    `UPDATE assets
                    SET quantity = ?, average_price = ?
                    WHERE user_id = ? AND symbol = ?`,
                    [newQuantity.toString(), newAveragePrice.toString(), updateUserId, updateSymbol]
                );
            } else {
                await db.query(
                    `INSERT INTO assets (user_id, symbol, quantity, average_price)
                    VALUES (?, ?, ?, ?)`,
                    [updateUserId, updateSymbol, updateAssetData.executed_quantity, updateAssetData.average_price]
                );
            }
            
        } catch (error) {
            console.error("Error in increaseAsset:", error);
        throw error;
        }
    }
    
    async decreaseAsset(updateAssetData) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("/USDT","");
        let newQuantity;

        try {
            const existingAsset = await db.query(
                `SELECT quantity
                FROM assets
                WHERE user_id = ? AND symbol = ?`,
                [updateUserId, updateSymbol]
            );

            const currentQuantity = new Decimal(existingAsset[0].quantity);
            newQuantity = currentQuantity.minus(updateAssetData.executed_quantity);

            await db.query(
                `UPDATE assets
                SET quantity = ?
                WHERE user_id = ? AND symbol = ?`,
                [newQuantity.toString(), updateUserId, updateSymbol]
            );
        } catch (error) {
            console.error("Error in decreaseAsset:", error);
        throw error;
        }
    }

    async unlockAsset(updateAssetData) {
        const updateUserId = updateAssetData.user_id;
        const updateSymbol = updateAssetData.symbol.replace("/USDT","");
        try {
            await db.query(
                `UPDATE assets
                SET locked_quantity = locked_quantity - ?
                WHERE user_id = ? AND symbol = ?`,
                [updateAssetData.executed_quantity, updateUserId, updateSymbol]
            );
        } catch (error) {
            console.error("Error in unlockAsset:", error);
            throw error;
        }
    }

    async deleteOrder(order_id, price, quantity, status){
        console.log("deleteOrder")
    }

}

export default new TradeModel();