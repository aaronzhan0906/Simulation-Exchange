import pool from "../config/database.js";



class HomeModel {
    async getSymbols() {
        const connection = await pool.getConnection();
        try {
            const symbols = await pool.query(
                `select * from symbols`
            );
            
            // return symbols array
            return symbols;
        } catch (error) {
            console.error("Error in getSymbols:", error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

export default new HomeModel();