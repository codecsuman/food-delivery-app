import jwt from "jsonwebtoken";
import { Response } from "express";
import { IUserDocument } from "../models/user.model.js";

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
      expiresIn: "7d",
    },
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

// Clear token (Logout)
export const clearToken = (res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    expires: new Date(0),
  });
};
