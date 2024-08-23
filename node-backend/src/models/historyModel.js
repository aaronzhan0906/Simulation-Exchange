import pool from "../config/database.js";


class HistoryModel {
    async getSymbols() {
        const connection = await pool.getConnection();
        try {
            const symbols = await pool.query(
                `select * from symbols`
            );
            
            // return symbols array
            return symbols;
        } finally {
            connection.release();
        }
    }

    async getTransactionsById(userId) {
        const [rows] = await db.query(
            `SELECT 
                symbol, 
                side,
                type,
                price, 
                quantity, 
                amount, 
                executed_at 
            FROM transactions 
            WHERE user_id = ?
            ORDER BY executed_at DESC`,
            [userId]
        );
        return rows;
    }
}

export default new HistoryModel();