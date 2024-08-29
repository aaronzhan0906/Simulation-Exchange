import jwt from "jsonwebtoken";
import config from "../config/config.js";
import UserModel from "../models/userModel.js";

async function authenticateToken(req, res, next) {
    try {
        // check access token
        const { accessToken } = req.cookies
        if (accessToken) {
            try {
                const { userId, email, role } = jwt.verify(accessToken, config.jwt.accessTokenSecret);
                req.user = { userId, email };
                return next();
            } catch (error) {
                // keep going to check refresh token
            }
        }
        const { userId } = req.cookies.userId;
        
        const refreshToken = await UserModel.getRefreshTokenByUserId(userId);
        if (refreshToken) {
            try {
                const { userId, email } = jwt.verify(refreshToken, config.jwt.refreshTokenSecret);
                const newAccessToken = UserModel.generateAccessToken({ userId, email });

                res.cookie("accessToken", newAccessToken, {
                    maxAge: 15 * 60 * 1000,
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict"
                });

                req.user = { userId, email };
                return next();
            } catch (error) {
                // keep going to check market maker token
            }
        }

        const marketMakerToken = req.headers["x-market-maker-token"];  
        if (marketMakerToken) {
            try {
                const { userId, role } = jwt.verify(marketMakerToken, config.jwt.accessTokenSecret);
                if (role === "market-maker") {
                    req.user = { userId, role };
                    return next();
                }
            } catch (error) {
                // return 401
            }
        }


        return res.status(401).json({ error: true, message: "Unauthorized" });
    } catch (error) {
        console.error("Error in authenticateToken: ", error);
        return res.status(403).json({ error: true, message: "Invalid access token" });
    }
}
 

function generateLongLivedToken (userId, role) {
    return jwt.sign(
        { userId, role },
        config.jwt.accessTokenSecret,
        { expiresIn: "3m" }
    );
}



export default authenticateToken;