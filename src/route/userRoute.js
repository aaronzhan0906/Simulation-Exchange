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
        res.status(200).json({ response: "ok", message: "User has been log in" });}
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
            return res.status(400).json({ response: "Unauthorized" });
        }

        // check email in payload
        const payload = jwt.verify(refreshToken,config.refreshTokenSecret);
        const userEmail = payload.email;
        const userExist = await userService.getUserByEmail(userEmail);
        if (!userExist) {
            return res.status(401).json({ response: "User Not Found"})
        }
        
        res.status(200).json({ response: "ok", message: "User has been log in" });
    } catch (error){
        next(error)
    }
});


// PUT : log in //
router.put("/auth", async (req, res, next) => {
    try{
        // get log in info
        const { email , password } = req.body;
        const user = await userService.getUserByEmail(email);

        if(!user) {
            return res.status(401).json({ response: "User Not Found" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid)
            return res.status(401).json({ response: "Invalid credentials" });
        
        // make jwt 
        const refreshToken = jwt.sign (
            { userId: user.id },
            config.refreshTokenSecret,
            { expiresIn: config.refreshTokenLife } 
        );

         // send cookie to frontend
        res.cookie("refreshToken", refreshToken, {
            maxAge:  7 * 24 * 60 * 60 * 1000, 
            httpOnly: process.env.NODE_ENV === true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: "strict"
        });

        res.status(200).json({ response: "ok", message:"User log in successfully" });
    } catch (error) {
        next(error)
    }
});


// POST : log out //
router.post("/logout", async (req, res, next) => {
    try {
        res.clearCookie("refreshToken");
        res.status(200).json({ response: "ok", message:"Log out successfully" });
    } catch (error) {
        next(error)
    }
});

export default router;