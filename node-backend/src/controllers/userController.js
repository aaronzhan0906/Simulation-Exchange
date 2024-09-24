import config from "../config/config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; 
import UserModel from "../models/userModel.js";
import { logger } from "../app.js";

class UserController {
    // router.post("/signup", userController.register);
    async register(req, res) {
        try {
            const { email, password } = req.body;
            const checkEmailExist = await UserModel.checkEmailExist(email);
            if (checkEmailExist) {
                return res.status(400).json({ error: true, message: "Email already exists" });
            };

            const result = await UserModel.createUserWithInitialFunds({ email, password });

            if (result.success) {
                return res.status(201).json({ ok: true, message: "User registered successfully" });
            } else {
                return res.status(400).json({ error: true, message: "Failed to register user", details: result.error });
            }
        } catch(error) {
            logger.error(`[register] ${error}`);
        }
    }

    // router.get("/auth", userController.getInfo);
    async getInfo(req, res) {
        try {
            // check access token
            const { accessToken } = req.cookies
            if ( accessToken ) {
                const { userId, email } = jwt.verify(accessToken, config.jwt.accessTokenSecret);
                return res.status(200).json({ ok: true, message: "User is logged in", user:{ userId, email }})
            } 
            
            const refreshToken = await UserModel.getRefreshTokenByUserId(userId);
            if (!refreshToken) {
                return res.status(401).json({ error: true, message: "Unauthorized" });
            }

            try {
                const { userId, email } = jwt.verify(refreshToken, config.jwt.refreshTokenSecret);
                const user = { user_id: userId, email: email };
                const newAccessToken = UserModel.generateAccessToken({ user });
            
            res.cookie("accessToken", newAccessToken, {
                maxAge: 24 * 60 * 60 * 1000, 
                httpOnly: true, 
                secure: true, 
                sameSite: "strict"
            });

            return res.status(200).json({ ok: true, message: "New access token issued", user: { userId, email } });
            } catch (error) {
                return res.status(401).json({ error: true, message: "Your login session has expired" });
            }
        } catch (error) {
            logger.error(`[getInfo] ${error}`);
        }
    }

    // router.post("/auth", userController.login);
    async login(req, res) {
        try{
            const { email, password } = req.body;
            const userInfo = await UserModel.getUserByEmail(email);

            if ( userInfo.length === 0 ) { 
                return res.status(401).json({ error: true, message: "Incorrect Email or password" });
            }
            
            const isPasswordValid = await bcrypt.compare(password, userInfo[0].password);
            if (!isPasswordValid)
                return res.status(401).json({ error: true, message: "Incorrect Email or password" });

            const user = userInfo[0]
            const accessToken = UserModel.generateAccessToken(user);
            const refreshToken = UserModel.generateRefreshToken(user);

            // clear cookies
            res.clearCookie("accessToken");
            res.clearCookie("userId");

            res.cookie("accessToken", accessToken, {
                maxAge: 24 * 60 * 60 * 1000, 
                httpOnly: true, 
                secure: true, 
                sameSite: "strict"
            });

            // give userId to Frontend
            res.cookie("userId", user.user_id, {
                maxAge: 30 * 24 * 60 * 60 * 1000, 
                httpOnly: true,
                secure: true,
                sameSite: "strict"
            });

            await UserModel.saveRefreshToken(user.user_id, refreshToken);

            const loginProof = {
                isLogin: true
            }

            res.status(200).json({ ok: true, message: "User logged in successfully", loginProof: loginProof });
        } catch (error) {
            logger.error(`[login] ${error}`);
        }
    }

    // router.post("/logout", userController.logout);
    async logout(req, res) {
        try {
            const { accessToken } = req.cookies;
            if ( accessToken ) {
                const { userId } = jwt.verify(accessToken, config.jwt.accessTokenSecret);
                await UserModel.removeRefreshToken( userId )
            }

            res.clearCookie("userId");
            res.clearCookie("accessToken");
            res.status(200).json({ ok: true, message: "Logged out successfully" });
        } catch (error) {
            logger.error(`[logout] ${error}`);
        }
    }
}

export default new UserController();