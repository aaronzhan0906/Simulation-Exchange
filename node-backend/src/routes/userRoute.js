import express from "express";
import userController from "../controllers/userController.js";

const router = express.Router();

router.post("/signup", userController.register);
router.get("/auth", userController.getInfo);
router.post("/auth", userController.login);
router.patch("/logout", userController.logout);

export default router;