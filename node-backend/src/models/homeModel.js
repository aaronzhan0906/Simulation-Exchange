import pool from "../config/database.js";
import { logger } from "../app.js";



class HomeModel {
    async getSymbols() {
        const connection = await pool.getConnection();
        try {
            const [symbols] = await connection.query(
                `select * from symbols`
            );
            
            return symbols; // return symbols array
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

            logger.error(`[getSymbols] ${JSON.stringify(errorDetails, null, 2)}`);
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default new HomeModel();