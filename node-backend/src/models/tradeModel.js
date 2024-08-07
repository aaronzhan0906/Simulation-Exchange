import db from "../config/database.js";


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

    async updateOrderStatus(orderId, status, updatedAt) {
        const result = await db.query(
            "UPDATE orders SET status = ?, updated_at = ? WHERE order_id =?",
            [status, updatedAt, orderId]
        )
        return result.affectedRows > 0;
    }

    async decreaseBalance(userId, amount){
        const result = await db.query (
            "UPDATE users SET = balance - ? WHERE user_id = ?",
            [amount, userId]
        );
    }

    async increaseAsset(userId, symbol, quantity){
        await db.query(
            `INSERT INTO user_assets (user_id, symbol, quantity)
            VALUES(?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [userId, symbol, quantity, quantity]
        )
    }

    async increaseBalance(userId, amount) {
        await db.query(
            "UPDATE users SET balance = balance + ? WHERE user_id = ?",
            [amount, userId]
        )
    }

    async decreaseAsset(userId, symbol, quantity) {
        await db.query(
            "UPDATE assets SET quantity - quantity WHERE user_id = ? AND symbol = ?",
            [quantity, userId, symbol]
        );
    }

    async createTransaction(transactionData) {
        const {
            transaction_id,
            order_id,
            user_id,
            symbol,
            side,
            type,
            price,
            quantity,
            executed_at
        } = transactionData;
        const result = await db.query(
            `INSERT INTO transactions 
            (transaction_id, order_id, user_id, symbol, side, type, price, quantity, executed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [transaction_id, order_id, user_id, symbol, side, type, price, quantity, executed_at]
        );

        if (result.affectedRows > 0) {
            return {
                side,
                price,
                quantity
            };
        } else {
            throw new Error("Failed to create transaction");
        }
    }
}

export default new TradeModel();