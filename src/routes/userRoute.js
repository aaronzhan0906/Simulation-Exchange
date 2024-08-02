import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

// POST : register
router.post("/register", userController.register);

// GET : get info
router.get("/auth", userController.getInfo);

// POST : log in
router.post("/auth", userController.login);

// POST : log out
router.post("/logout", userController.logout);

export default router;