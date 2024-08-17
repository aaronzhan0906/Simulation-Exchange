import db from "../config/database.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import bcrypt from "bcryptjs";

class UserModel {
    async checkEmailExist(email) {
        const connection = await db.getConnection();

        try {
            const [result] = await connection.query(
                "SELECT email FROM users WHERE email = ?",
                email
            );
            console.log(result.length);
            if (result.length === 1) {
                return true;
            }
        } catch(error) {
            await connection.rollback();
            throw error
        } finally {
            connection.release();
        }
    };


    async createUserWithInitialFunds(userData) {
        const { email, password } = userData;
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();
            const hashedPassword = await bcrypt.hash(password, 10)
            const [userResult] = await connection.query(
                "INSERT INTO users (email, password) VALUES (?, ?)",
                [email, hashedPassword]
            )
            const userId = userResult.insertId;
            
            await connection.query(
                "INSERT INTO accounts (user_id, balance) VALUES (?, ?)",
                [userId, 10000] 
            );

            await connection.query(
                `INSERT INTO assets (user_id, symbol, quantity) VALUES (?, ?, ?)`,
                [userId, "btc", 0.17]
            );

            await connection.commit();
            return { user_id: userId };
        } catch(error) {
            await connection.rollback();
            throw error
        } finally {
            connection.release();
        }
    };

    async getUserByEmail(email) {
        const command = "SELECT user_id, email, password FROM users WHERE email = ?";
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