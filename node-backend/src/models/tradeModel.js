import db from "../config/database.js";
import Decimal from 'decimal.js';

class TradeModel {
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
                quantity: new Decimal(oldData.quantity),
                executed_quantity: new Decimal(oldData.executed_quantity),
                remaining_quantity: new Decimal(oldData.remaining_quantity),
                average_price: new Decimal(oldData.average_price)
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

            return resultOrderData
        } catch (error) {
        console.error("Error in updateOrder:", error);
        throw error;
        }
    }

    // async decreaseBalance(userId, amount){
    //     const result = await db.query (
    //         "UPDATE users SET = balance - ? WHERE user_id = ?",
    //         [amount, userId]
    //     );
    // }

    // async increaseBalance(userId, amount) {
    //     await db.query(
    //         "UPDATE users SET balance = balance + ? WHERE user_id = ?",
    //         [amount, userId]
    //     )
    // }

    async increaseAsset(updateAssetData){
        try {
            const existingAsset = await db.query(
                `SELECT symbol, quantity, average_price
                FROM assets
                WHERE user_id = ? AND symbol = ?`,
                [updateAssetData.user_id, updateAssetData.symbol]
            );
            if (oldData.symbol) {
                addNewAsset
            } else {
                plusNewAsset
            }

            const old = {
                quantity: new Decimal(oldData.quantity),
                average_price: new Decimal(oldData.average_price)
            };

            const addNewAsset = await db.query(
                `INSERT INTO user_assets (user_id, symbol, quantity)
                VALUES(?, ?, ?)
                ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
                [userId, symbol, quantity, quantity]
            )

        } catch (error) {
            console.error("Error in increaseAsset:", error);
            throw error;
        }
    }

    async decreaseAsset(userId, symbol, quantity) {
        await db.query(
            "UPDATE assets SET quantity - quantity WHERE user_id = ? AND symbol = ?",
            [quantity, userId, symbol]
        );
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
}

export default new TradeModel();