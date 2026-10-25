import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const transport = isProduction
  ? undefined
  : {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    };

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  transport,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.cookies.token",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "res.headers['set-cookie']",
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.api_key",
      "*.secretKey",
      "*.secret_key",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    service: "food-delivery-api",
    env: process.env.NODE_ENV || "development",
  },
});

export const createChildLogger = (bindings: Record<string, unknown>) => {
  return logger.child(bindings);
};

export default logger;