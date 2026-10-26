import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

/**
 * Request logging with a correlation id. The id is echoed in the response so a
 * browser/network trace can be matched to server logs, and slow requests are
 * surfaced at warn level instead of drowning in normal INFO volume.
 */
export const slowRequestThreshold = () =>
  Number(process.env.SLOW_REQUEST_MS) || 1000;

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(incoming)
      ? incoming
      : randomUUID();

  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  logger.info(
    { method: req.method, path: req.path, ip: req.ip, requestId },
    "Incoming request",
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const payload = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId,
    };

    if (res.statusCode >= 500) {
      logger.error(payload, "Request failed");
    } else if (duration >= slowRequestThreshold()) {
      logger.warn(payload, "Slow request");
    } else {
      logger.info(payload, "Request completed");
    }
  });

  next();
};

export default requestLogger;
