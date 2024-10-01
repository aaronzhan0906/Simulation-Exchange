import pool from "../config/database.js";
import { logger } from "../app.js";
import { formatErrorDetails } from "../utils/formattedError.js";

class MarketMakerService {
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

    async deleteMarketMakerOrdersRegularly() {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
    
            const [result] = await connection.query(
                `DELETE FROM orders 
                 WHERE user_id = ? 
                 AND status IN (?, ?, ?)`,
                [process.env.MARKET_MAKER_ID, "CANCELED", "filled", "PARTIALLY_FILLED_CANCELED"]
            );
    
            await connection.commit();
            logger.info(`Deleted ${result.affectedRows} old orders`);
        } catch (error) {
            await connection.rollback();
            this.logError("deleteMarketMakerOrdersRegularly", error);
        } finally {
            connection.release();
        }
    }

    async deleteMarketMakerTradesRegularly() {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
    
            const [result] = await connection.query(
                `DELETE FROM trades 
                 WHERE buyer_user_id = ? OR seller_user_id = ?`,
                [process.env.MARKET_MAKER_ID, process.env.MARKET_MAKER_ID]
            );
    
            await connection.commit();
            logger.info(`Deleted ${result.affectedRows} old trades`);
        } catch (error) {
            await connection.rollback();
            this.logError("deleteMarketMakerTradesRegularly", error);
        } finally {
            connection.release();
        }
    }
    
    startPeriodicCleanup() {
        setInterval(() => {
            logger.info("Deleting old market maker orders...");
            this.deleteMarketMakerOrdersRegularly();
            this.deleteMarketMakerTradesRegularly();
        }, 15 * 60 * 1000); 
    }
    
}

export default new MarketMakerService();