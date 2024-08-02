import db from "../config/database.js";
import config from "../config/config.js";
import bcrypt from bcrypt

class UserModel {
    async createUser(userData) {
        const { displayname, email, password } = userData;
        try {
            await db.beginTransaction();
            const hashedPassword = await bcrypt.hash(password, 10)
            const [userResult] = await db.query(
                "INSERT INTO users (displayname, email, password) VALUES (?, ?, ?)",
                [displayname, email, hashedPassword]
            )
            const userId = userResult.insertId;

            await db.query(
                "INSERT INTO accounts (user_id, balance) VALUES (?, ?)",
                [userId, 10000] 
            );
            await db.query(
                "INSERT INTO assets (user_id, symbol, amount, average_purchase_cost) VALUES (?, ?, ?, ?)",
                [userId, usdt, 10000, 1]
            )
            await db.commit();
            return { user_id: userId };
        } catch(error) {
            await db.rollback();
            throw error
        }
    };

    async getUserByEmail(email) {
        const command = "SELECT user_id, displayname, email, password FROM users WHERE email = ?";
        const result = await db.query(command, [email]);
        return result;
    }

    generateAccessToken(user) {
        return jwt.sign(
            { userId: user.user_id, email: user.email },
            config.jwt.accessTokenSecret,
            { expiresIn: config.jwt.accessTokenLife }
        )
    }

    generateRefreshToken(user) {
        return jwt.sign(
            { userId: user.user_id, email: user.email },
            config.jwt.refreshTokenSecret,
            { expiresIn: config.jwt.refreshTokenLife }
        )
    }

    async removeRefreshToken(userId) {
        await db.query(
            "UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE user_id = ?",
            [userId]
        );
    }

    async saveRefreshToken(userId, refreshToken){
        const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
        await db.query(
            "UPDATE users SET refresh_token = ?, refresh_token_expires_at = ? WHERE user_id = ?",
            [refreshToken, expiresAt, userId]
        );
    }
}


export default new UserModel();