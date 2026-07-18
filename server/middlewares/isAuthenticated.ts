import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      id: string;
      admin: boolean;
      email: string;
    }
  }
}

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login to access this resource",
      });
    }

    if (!process.env.SECRET_KEY) {
      console.error("❌ SECRET_KEY is not defined in environment variables");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY) as jwt.JwtPayload;
    } catch (jwtError: any) {
      if (jwtError.name === "TokenExpiredError") {
        res.clearCookie("token");
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    if (!decoded?.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.id = decoded.userId as string;
    req.admin = (decoded.admin as boolean) || false;
    req.email = (decoded.email as string) || "";

    next();
  } catch (error) {
    console.error("❌ Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Middleware to check if user is admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.admin) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};
