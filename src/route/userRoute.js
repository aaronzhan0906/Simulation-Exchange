import express from "express";
import config from "../config/config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"; 
import userService from "../service/userService.js";


const router = express.Router();


// POST : sign up //
router.post("/", async (req, res, next) => {
    try {
        const {displayname , email, password }  = req.body;
        console.log(req.body)

        const hashedPassword = await bcrypt.hash(password, 10);

        const createUser = await userService.createUser({ displayname, email, password: hashedPassword });
        
        if (createUser) {
        res.status(200).json({ "ok": true, message: "User sign up" });}
    } catch(error) {
        next(error);
    }
});


// GET : get info //
router.get("/auth",async (req, res, next) => {
    try {
        // check jwt
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ "error": true, message: "Unauthorized" });
        }

        // check email in payload
        const payload = jwt.verify(refreshToken, config.jwt.refreshTokenSecret);
        console.log(payload)
        const email = payload.email;
        const userExist = await userService.getUserByEmail(email);
        if (!userExist) {
            return res.status(401).json({ "error": true, message: "User Not Found"})
        }
        
        res.status(200).json({ "ok": true, message: "User has been log in" });
    } catch (error){
        next(error)
    }
});


// PUT : log in //
router.put("/auth", async (req, res, next) => {
    try{
        // get log in info
        const { email , password } = req.body;
        const userInfo = await userService.getUserByEmail(email);

        if(!userInfo) {
            return res.status(401).json({ "error": true, message: "User Not Found" });
        }

        const isPasswordValid = await bcrypt.compare(password, userInfo[0].password);
        if (!isPasswordValid)
            return res.status(401).json({ "error": true, message: "Invalid credentials" });

        // make jwt 
        const refreshToken = jwt.sign (
            { email: userInfo[0].email },
            config.jwt.refreshTokenSecret,
            { expiresIn: config.jwt.refreshTokenLife } 
        );

         // send cookie to frontend
        res.cookie("refreshToken", refreshToken, {
            maxAge:  7 * 24 * 60 * 60 * 1000, 
            httpOnly: process.env.NODE_ENV === true, // Use httpOnly in production
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: "strict"
        });

        res.status(200).json({ "ok": true, message: "User log in successfully" });
    } catch (error) {
        next(error)
    }
});


// POST : log out //
router.post("/logout", async (req, res, next) => {
    try {
        res.clearCookie("refreshToken");
        res.status(200).json({ "ok": true, message: "Log out successfully" });
    } catch (error) {
        next(error)
    }
});

export default router;