import pool from "../config/database.js";


class WalletModel {
    async getBalanceById(userId) {
        const connection = await pool.getConnection();
        try {  
            const [[balance]] = await connection.query(
            "SELECT balance FROM accounts WHERE user_id = ?",
            [userId]);

            return balance;
        } finally {
        connection.release();
        }
    }

    async getAvailableById(userId) {
        const connection = await pool.getConnection();
        try {
            const [[available]] = await connection.query(
                "SELECT available_balance FROM accounts WHERE user_id = ?",
                [userId]
            );
            return available;
        } finally{
            connection.release();
        }
    }

    async getAssetsById(userId){
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                "SELECT symbol, amount, average_purchase_cost FROM assets WHERE user_id = ?",
                [userId]
            );
            return [rows];
        } finally {
            connection.release();
        }
    }

    async getAmountOfSymbolById(userId){
        const connection = await pool.getConnection();
        try {
            const result = await connection.query(
                "SELECT amount FROM assets WHERE user_id = ? AND symbol = ?",
                [userId, symbol]
            );

            return result.length > 0 ? result[0] : 0;
        } finally {
            connection.release();
        }
    }
}

export default new WalletModel();