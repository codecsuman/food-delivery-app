/**
 * Single source of truth for browser → API URLs.
 *
 * Production deliberately uses the page origin instead of the absolute Render
 * URL. Vercel rewrites `/api/*`, `/health` and `/socket.io/*` to the backend,
 * so privacy extensions and ad blockers that block `*.onrender.com` cannot
 * break the whole app. It also makes the auth cookie first-party.
 *
 * Local development keeps the configured backend URL (or a relative path when
 * the Vite dev proxy is used).
 */
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);

const pageOrigin =
  typeof window !== "undefined" ? window.location.origin : "";

export const API_BASE_URL = import.meta.env.DEV
  ? configuredApiBase || "/api/v1"
  : "/api/v1";

export const SOCKET_URL = import.meta.env.DEV
  ? import.meta.env.VITE_SOCKET_URL ||
    configuredApiBase.replace(/\/api\/v1$/, "") ||
    pageOrigin
  : pageOrigin;
