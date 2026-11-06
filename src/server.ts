import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import app from "./app.js";
import prisma from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}; closing server`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
