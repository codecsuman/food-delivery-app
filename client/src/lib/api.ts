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
import axios from "axios";

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

/**
 * True when a request was answered with the SPA's index.html instead of JSON.
 * This happens when a proxy/host rewrite misses an API path (for example a
 * trailing-slash URL such as `/api/v1/order/`). Without this guard Axios would
 * treat the HTML page as a successful response and screens like Home or My
 * Orders would silently render an empty state.
 */
const isHtmlResponse = (data: unknown): boolean =>
  typeof data === "string" && /^\s*<(?:!doctype html|html)/i.test(data);

axios.interceptors.response.use(
  (response) => {
    if (isHtmlResponse(response.data)) {
      return Promise.reject(
        new Error(
          "The server returned a web page instead of API data. Please refresh and try again.",
        ),
      );
    }
    return response;
  },
  (error) => Promise.reject(error),
);

