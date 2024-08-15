import config from "../config/config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; 
import UserModel from "../models/userModel.js";

class UserController {
    // router.post("/signup", userController.register);
    async register(req, res) {
        try {
            const { email, password } = req.body;
            const checkEmailExist = await UserModel.checkEmailExist(email);
            if (checkEmailExist) {
                return res.status(400).json({ "error": true, message: "Email already exists" });};


            await UserModel.createUserWithInitialFunds({ email, password });
                return res.status(201).json({ ok: true, message: "User registered successfully" });
        } catch(error) {
            console.error(error);
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
                // create new access token
                const newAccessToken = UserModel.generateAccessToken({ userId, email });
            
            res.cookie("accessToken", newAccessToken, {
                maxAge: 15 * 60 * 1000, 
                httpOnly: true, 
                secure: true, 
                sameSite: "strict"
            });

            return res.status(200).json({ ok: true, message: "New access token issued", user: { userId, email } });
            } catch (error) {
                return res.status(401).json({ error: true, message: "Invalid refresh token" });
            }
        } catch (error) {
            console.error(error);

        }
    }

    // router.put("/auth", userController.login);
    async login(req, res) {
        try{
            const { email, password } = req.body;
            const userInfo = await UserModel.getUserByEmail(email);
            const user = userInfo[0]

            if(!userInfo) {
                return res.status(401).json({ "error": true, message: "User Not Found" });
            }

            const isPasswordValid = await bcrypt.compare(password, userInfo[0].password);
            if (!isPasswordValid)
                return res.status(401).json({ "error": true, message: "Invalid credentials" });
            
            const accessToken = UserModel.generateAccessToken(user);
            const refreshToken = UserModel.generateRefreshToken(user);

            res.cookie("accessToken", accessToken, {
                maxAge: 7 * 24 * 60 * 60 * 1000, // 之後改
                httpOnly: true, 
                secure: true, 
                sameSite: "strict"
            });

            await UserModel.saveRefreshToken(user.user_id, refreshToken);

            const loginProof = {
                isLogin: true
            }

            res.status(200).json({ "ok": true, message: "User logged in successfully", loginProof: loginProof });
        } catch (error) {
            console.error(error);
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

            res.clearCookie("accessToken");
            res.status(200).json({ "ok": true, message: "Logged out successfully" });
        } catch (error) {
            console.error(error);
        }
    }
}

export default new UserController();