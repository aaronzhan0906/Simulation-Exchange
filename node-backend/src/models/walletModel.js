import db from "../config/database.js";


class WalletModel {
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
}

export default new WalletModel();