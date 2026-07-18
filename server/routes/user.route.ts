import express from "express";
import {
  checkAuth,
  forgotPassword,
  getProfile, // ADDED
  login,
  logout,
  resetPassword,
  signup,
  updateProfile,
  verifyEmail,
} from "../controller/user.controller.ts";
import { isAuthenticated } from "../middlewares/isAuthenticated.ts";

const router = express.Router();

// Auth routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

// Email verification
router.post("/verify-email", verifyEmail);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected routes
router.get("/check-auth", isAuthenticated, checkAuth);
router.get("/profile", isAuthenticated, getProfile); // ADDED - for refreshUser
router.put("/profile/update", isAuthenticated, updateProfile);

export default router;
