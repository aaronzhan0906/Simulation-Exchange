import jwt from "jsonwebtoken";
import config from "../config/config.js";
import UserModel from "../models/userModel.js";

async function authenticateToken(req, res, next) {
    try {
        // check access token
        const { accessToken } = req.cookies
        if ( accessToken ) {
            const { userId, email } = jwt.verify(accessToken, config.jwt.accessTokenSecret);
            req.user = { userId, email}
            return next();
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

        req.user = { userId, email }
        return next();
        } catch (error) {
            return res.status(403).json({ error: true, message: "Invalid refresh token" });
        }
    } catch (error) {
        next(error);
    }
}
 
export default authenticateToken;