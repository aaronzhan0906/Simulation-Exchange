import db from "../config/database.js";


class HistoryModel {
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