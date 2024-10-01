import pool from "../config/database.js";
import { logger } from "../app.js";
import { formatErrorDetails } from "../utils/formattedError.js";


class HistoryModel {
    async getSymbols() {
        const connection = await pool.getConnection();
        try {
            const [symbols] = await connection.query(
                `SELECT * FROM symbols`
            );
            
            // return symbols array
            return symbols;
        } catch (error) {
            const errorDetails = {
                message: error.message,
                stack: error.stack,
                code: error.code,
                errno: error.errno,
                sql: error.sql,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            };
            
            logger.error(`[getSymbols] Error:\n${formatErrorDetails(errorDetails)}`);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getOrderHistory(userId, timeRange){
        const connection = await pool.getConnection();
        try {
            let query = `
            SELECT symbol, side ,type, price , quantity, executed_quantity, average_price, status, created_at
            FROM orders WHERE user_id = ?`;

            let params = [userId];

            switch (timeRange) {
                case "today":
                    query += ` AND created_at >= CURDATE()`;
                    break;

                case "seven_days": 
                    query += ` AND created_at >= CURDATE() - INTERVAL 7 DAY`;
                    break;

                case "one_month":
                    query += ` AND created_at >= CURDATE() - INTERVAL 1 MONTH`;
                    break;

                case "all":
                    break;
            }   

            query += ` ORDER BY created_at DESC`; // Needing to add a space before ORDER BY
            const [rows] = await connection.query(query, params);
            return rows;            
        } catch (error) {
            const errorDetails = {
                message: error.message,
                stack: error.stack,
                code: error.code,
                errno: error.errno,
                sql: error.sql,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            };
            
            logger.error(`[getOrderHistory] Error:\n${formatErrorDetails(errorDetails)}`);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getTransactionsById(userId) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
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
        } catch (error) {
            const errorDetails = {
                message: error.message,
                stack: error.stack,
                code: error.code,
                errno: error.errno,
                sql: error.sql,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            };
            
            logger.error(`[getTransactionsById] Error:\n${formatErrorDetails(errorDetails)}`);
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default new HistoryModel();