// =========================
// ENVIRONMENT LOADING
// =========================
// This module MUST be imported before any other module that reads
// `process.env` at import time (e.g. services/mapService.ts).
// ES module imports are evaluated in declaration order, so importing this
// file first guarantees the .env file is loaded before those modules run.
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Works both when running from source (server/config) and from dist (dist/config).
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const isProduction = process.env.NODE_ENV === "production";
