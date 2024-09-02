import pool from "../config/database.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import bcrypt from "bcryptjs";

class UserModel {
    async checkEmailExist(email) {
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.query(
                "SELECT email FROM users WHERE email = ?",
                email
            );
            if (result.length === 1) {
                return true;
            }
        } catch(error) {
            console.error("Error in checkEmailExist: ", error);
            throw error
        } finally {
            connection.release();
        }
    };


    async createUserWithInitialFunds(userData) {
        const { email, password } = userData;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const hashedPassword = await bcrypt.hash(password, 10)
            const [userResult] = await connection.query(
                "INSERT INTO users (email, password) VALUES (?, ?)",
                [email, hashedPassword]
            )
            const userId = userResult.insertId;
            
            await connection.query( // 10000 is the initial balance
                "INSERT INTO accounts (user_id, balance) VALUES (?, ?)",
                [userId, 10000] 
            );

            await connection.commit();
            return { user_id: userId };
        } catch(error) {
            await connection.rollback();
            console.error("Error in createUserWithInitialFunds: ", error);
            throw error
        } finally {
            connection.release();
        }
    };

    async getUserByEmail(email) {
        const command = "SELECT user_id, email, password FROM users WHERE email = ?";
        const result = await pool.query(command, [email]);
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
    async getRefreshTokenByUserId(userId){
        try{
            const [result] = await pool.query(
                "SELECT refresh_token FROM users WHERE user_id = ?",
                [userId]
            );
            if (result.length > 0 && result[0].refresh_token) {
                const refreshToken = result[0].refresh_token;
                
                try {
                    jwt.verify(refreshToken, config.jwt.refreshTokenSecret);
                    return refreshToken;
                } catch (error) {
                    if (error instanceof jwt.TokenExpiredError) {
                        await this.removeRefreshToken(userId);
                    }
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.error("Error in getRefreshTokenByUserId: ", error);
            throw error;
        }
    }

    async removeRefreshToken(userId) {
        await pool.query(
            "UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE user_id = ?",
            [userId]
        );
    }

    async saveRefreshToken(userId, refreshToken){
        const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
        await pool.query(
            "UPDATE users SET refresh_token = ?, refresh_token_expires_at = ? WHERE user_id = ?",
            [refreshToken, expiresAt, userId]
        );
    }
}


export default new UserModel();