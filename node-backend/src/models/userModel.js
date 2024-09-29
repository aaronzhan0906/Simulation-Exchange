import pool from "../config/database.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import bcrypt from "bcryptjs";
import { logger } from "../app.js";

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
            logger.error(`Error in checkEmailExist: ${error}`);
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
            return { success: true };
        } catch(error) {
            await connection.rollback();
            logger.error(`Error in createUserWithInitialFunds: ${error}`);
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    };

    async getUserByEmail(email) {
        try {
            const command = "SELECT user_id, email, password FROM users WHERE email = ?";
            const result = await pool.query(command, [email]);
            return result;
        } catch (error) {
            logger.error(`[getUserByEmail]: ${error}`);
            throw error;
        }
    }

    generateAccessToken(user) {
        // console.log(`[generateAccessToken] ${JSON.stringify(user)}`);
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
            const result = await pool.query(
                "SELECT refresh_token FROM users WHERE user_id = ?",
                [userId]
            );
            if (result.length > 0 && result[0].refresh_token !== null) {
                return result[0].refresh_token
            } else {
                return null;
            }
        } catch (error) {
            logger.error(`[getRefreshTokenByUserId]: ${error}`);
            throw error;
        }
    }

    async removeRefreshToken(userId) {
        try { 
            await pool.query(
                `UPDATE users 
                SET refresh_token = NULL 
                WHERE user_id = ?`,
                [userId]
            );
        } catch(error) {
            logger.error(`[removeRefreshToken]: ${error}`);
            throw error;
        }
    }

    async saveRefreshToken(userId, refreshToken){
        try {
            const result = await pool.query(
                `UPDATE users 
                SET refresh_token = ?
                WHERE user_id = ?`,
                [refreshToken, userId]
            );

            if (result.affectedRows > 0){
                return { success: true };
            } else {
                logger.warn(`[saveRefreshToken]: No user found with ID ${userId}`);
            }
        } catch {
            logger.error(`[saveRefreshToken]: ${error}`);
            throw error;
        }
        
    }
}


export default new UserModel();