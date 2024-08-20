import pool from "../config/database.js";



class HomeModel {
    async getSymbols() {
        const connection = await pool.getConnection();
        try {
            const symbols = await pool.query(
                `select * from symbols`
            );
            console.log(symbols);
            // return symbols array
            return symbols;
        } finally {
            connection.release();
        }
         
    }
}

export default new HomeModel();