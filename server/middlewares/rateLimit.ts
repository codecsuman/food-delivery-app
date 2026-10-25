import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../utils/logger.js";

const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string
) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    // NOTE: do not set a custom keyGenerator here. express-rate-limit's
    // default keys requests by IP and correctly handles IPv6 subnets;
    // returning `req.ip` manually triggers ERR_ERL_KEY_GEN_IPV6 and allows
    // rate-limit bypass by rotating within an IPv6 /64.
    handler: (req: Request, res: Response) => {
      logger.warn(
        { ip: req.ip, path: req.path, userAgent: req.get("user-agent") },
        "Rate limit exceeded"
      );
      res.status(429).json({ success: false, message });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks and automated tests.
      return process.env.NODE_ENV === "test" || req.path === "/health";
    },
  });
};

export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests per window
  "Too many authentication attempts. Please try again later."
);

export const checkoutRateLimiter = createRateLimiter(
  10 * 60 * 1000, // 10 minutes
  5, // 5 checkout attempts per window
  "Too many checkout attempts. Please try again later."
);

export const mapRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // 30 requests per minute
  "Too many map requests. Please slow down."
);

export const reviewRateLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  3, // 3 reviews per window
  "Too many review submissions. Please try again later."
);

export const apiRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  100, // 100 requests per minute
  "Too many requests. Please try again later."
);

export const strictRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests per window
  "Too many attempts. Please try again later."
);