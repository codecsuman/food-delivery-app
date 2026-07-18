import jwt from "jsonwebtoken";
import { IUserDocument } from "../models/user.model";
import { Response } from "express";

export const generateToken = (res: Response, user: IUserDocument) => {
  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY is not defined in environment variables");
  }

  const token = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      admin: user.admin,
    },
    process.env.SECRET_KEY,
    {
      expiresIn: "7d", // Changed from 1d to 7d for better UX
    },
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms (matches JWT expiry)
  });

  return token;
};

// Helper to clear token (for logout)
export const clearToken = (res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", "", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    expires: new Date(0), // Expire immediately
  });
};
