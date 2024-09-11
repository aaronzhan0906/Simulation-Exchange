import pool from "../config/database.js";
import { formatErrorDetails } from "../utils/errorUtils.js";

class WalletModel {
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

    async getBalanceById(userId) {
        const connection = await pool.getConnection();
        try {  
            const [[balance]] = await connection.query(
            "SELECT balance FROM accounts WHERE user_id = ?",
            [userId]);
            return balance;
        } catch (error) {
            this.logError("getBalanceById", error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getAvailableBalanceById(userId) {
        const connection = await pool.getConnection();
        try {
            const [[available]] = await connection.query(
                "SELECT available_balance FROM accounts WHERE user_id = ?",
                [userId]
            );
            return available;
        } catch (error) {
            this.logError("getAvailableBalanceById", error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getBalanceOverView(userId) {
        const connection = await pool.getConnection();
        try {
            const [[availableAndLocked]] = await connection.query(
                `SELECT 
                balance, 
                available_balance, 
                locked_balance 
                FROM accounts WHERE user_id = ?`,
                [userId]
            );
            return availableAndLocked;
        } catch (error) {
            this.logError("getBalanceOverView", error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getAssetsAndSymbols(userId) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                `SELECT
                assets.symbol,
                assets.quantity,
                assets.average_price,
                assets.available_quantity,
                assets.locked_quantity,
                symbols.image_url
                FROM assets
                JOIN symbols ON assets.symbol = symbols.name
                WHERE assets.user_id =?`,
                [userId]
            );
            return rows;
        } catch (error) {
            this.logError("getAssetsAndSymbols", error);
            throw error;
        } finally {
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
        } catch (error) {
            this.logError("getAssetsById", error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getAvailableAmountOfSymbol(userId, symbol){
        const connection = await pool.getConnection();
        try {
            const [[availableAmount]] = await connection.query(
                "SELECT available_quantity FROM assets WHERE user_id = ? AND symbol = ?",
                [userId, symbol]
            );
            if (!availableAmount) {
                return 0;
            } // if result is empty, return 0

            return availableAmount;
        } catch (error) {
            this.logError("getAvailableAmountOfSymbol", error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default new WalletModel();