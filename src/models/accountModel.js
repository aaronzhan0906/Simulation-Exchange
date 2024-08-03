import db from "../config/database.js";


class AccountModel {
    async getBalanceById(userId) {
        await db.query(
            "SELECT amount FROM accounts WHERE user_id = ?",
            [userId]
        );
    }

    async getAssetsById(userId){
        const [rows] = await db.query(
            "SELECT symbol, amount, average_purchase_cost FROM assets WHERE user_id = ?",
            [userId]
        );
        return [rows];
    }

    async getAmountOfSymbolById(userId){
        const result = await db.query(
            "SELECT amount FROM assets WHERE user_id = ? AND symbol = ?",
            [userId, symbol]
        );

        return result.length > 0 ? result[0] : 0;
    }

    async getTransactionsById(userId){
        const [rows] = await db.query(
            "SELECT symbol, transaction_type, amount, price, executed_at FROM transactions WHERE user_id = ?",
            [userId]
        );
        return [rows];
    }

    async createOrder(user_id, symbol, order_type, amount, price, status) {
        const result = await db.query(
            "INSERT INTO orders (user_id, symbol, order_type, amount, price, status VALUES (?, ?, ?, ?, ?, ?)",
            [user_id, symbol, order_type, amount, price, status]
        )
        return result
    }
    


}

export default new AccountModel();