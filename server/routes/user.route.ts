import express from "express";
import {
  checkAuth,
  getProfile,
  login,
  logout,
  signup,
  updateProfile,
} from "../controller/user.controller.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { authRateLimiter } from "../middlewares/rateLimit.js";
import { validate } from "../middlewares/validate.js";
import { signupSchema, loginSchema, updateProfileSchema } from "../schemas/validation.js";

const router = express.Router();

// Auth routes with rate limiting and validation
router.post("/signup", authRateLimiter, validate(signupSchema), signup);
router.post("/login", authRateLimiter, validate(loginSchema), login);
router.post("/logout", isAuthenticated, logout);

// Protected routes
router.get("/check-auth", isAuthenticated, checkAuth);
router.get("/profile", isAuthenticated, getProfile);
router.put("/profile/update", isAuthenticated, validate(updateProfileSchema), updateProfile);

export default router;