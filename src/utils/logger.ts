import "dotenv/config";
import { mkdirSync } from "node:fs";
import winston from "winston";
import { env } from "../config/env.js";

mkdirSync("logs", { recursive: true });

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const consoleFormat = printf(({ level, message, stack }) => {
  return `[${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: json(),
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: json(),
    }),
  ],
});

if (env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),
  );
}
