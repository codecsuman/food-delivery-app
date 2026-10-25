import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger.js";

export const validate =
  (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Special handling for MongoDB ObjectIds in params to prevent generic 400s.
      // Only apply to params that are actually meant to be IDs — otherwise a
      // 6-digit pincode (which is hex-looking) would be rejected here.
      if (source === "params") {
        for (const key of Object.keys(req.params)) {
          if (!/(Id|_id)$/.test(key)) continue;
          const val = req.params[key];
          // If it looks like it's intended to be an ID but is the wrong length
          if (val.length !== 24 && /^[0-9a-fA-F]+$/.test(val)) {
            logger.warn({ path: req.path, param: key, value: val }, "Invalid ObjectId length detected");
            return res.status(400).json({
              success: false,
              message: `Invalid ${key} format. MongoDB IDs must be exactly 24 characters.`,
            });
          }
        }
      }

      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }[source]);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`);
        logger.warn(
          { path: req.path, errors: messages, ip: req.ip },
          "Validation failed"
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: messages,
        });
      }
      return res.status(500).json({ success: false, message: "Validation error" });
    }
  };

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  const sanitize = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") {
      return obj.trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Block MongoDB operators
        if (key.startsWith("$") || key.includes(".")) {
          continue;
        }
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body) as Record<string, unknown>;
  }
  next();
};

export const preventMassAssignment = (allowedFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== "object") {
      return next();
    }
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(req.body)) {
      if (allowedFields.includes(key)) {
        filtered[key] = req.body[key];
      }
    }
    req.body = filtered;
    next();
  };
};