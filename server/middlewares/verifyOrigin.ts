import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

/**
 * CSRF hardening for cookie-authenticated, state-changing requests.
 *
 * The app uses `SameSite=None` cookies in production (frontend and API live on
 * different origins), so the browser will attach the session cookie to a
 * cross-site form post. CORS does not stop that. This middleware rejects
 * mutations whose `Origin`/`Referer` is not an allow-listed frontend origin.
 *
 * It deliberately allows requests with neither header: those are not browser
 * cross-site requests (server-to-server, mobile clients, CLI) and still need a
 * valid session cookie. Stripe's webhook is exempt because it is authenticated
 * by signature instead.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_PATHS = ["/api/v1/order/webhook"];

const allowedOrigins = () =>
  (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    // Normalise away trailing slashes/paths so `https://app.example.com/`
    // matches the browser's `Origin: https://app.example.com`.
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin;
      }
    });

const isExempt = (req: Request) =>
  EXEMPT_PATHS.some(
    (path) =>
      req.path === path ||
      req.originalUrl === path ||
      req.originalUrl.startsWith(`${path}?`),
  );

/**
 * Returns the request's asserted origin, or `null` when the header is present
 * but malformed (which must be rejected, not ignored).
 */
const assertedOrigin = (req: Request): string | null | undefined => {
  const origin = req.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return undefined;
};

export const verifyRequestOrigin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isExempt(req)) return next();

  const origin = assertedOrigin(req);

  // No Origin and no Referer: not a browser cross-site request.
  if (origin === undefined) return next();

  if (origin === null) {
    logger.warn(
      { path: req.path, method: req.method, ip: req.ip },
      "Blocked state change with malformed Origin/Referer",
    );
    return res
      .status(403)
      .json({ success: false, message: "Request origin is not allowed" });
  }

  // Same-origin deployment (frontend served from the API host).
  const host = req.get("host");
  if (host) {
    try {
      if (new URL(origin).host === host) return next();
    } catch {
      // Fall through to the allow-list check.
    }
  }

  if (allowedOrigins().includes(origin)) return next();

  logger.warn(
    { origin, path: req.path, method: req.method, ip: req.ip },
    "Blocked cross-origin state change",
  );
  return res
    .status(403)
    .json({ success: false, message: "Request origin is not allowed" });
};

export default verifyRequestOrigin;
