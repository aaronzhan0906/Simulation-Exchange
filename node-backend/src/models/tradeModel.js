import db from "../config/database.js";


class TradeModel {
    async createOrder(order_id, user_id, symbol, order_type, price, quantity, amount, status) {
        const result = await db.query(
            "INSERT INTO orders (order_id, user_id, symbol, order_type, price, quantity, amount, status VALUES (?, ?, ?, ?, ?, ?)",
            [order_id, user_id, symbol, order_type, price, quantity, amount, status]
        )

        return result
    }
}

export default new TradeModel();