import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middlewares/error.middlewares.js";
import { AppError } from "./utils/appError.js";
import { HTTP_STATUS } from "./constants/httpStatus.js";
import authRoutes from "./modules/auth/auth.routes.js"
import organizationRoutes from "./modules/organization/org.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import partyRoutes from "./modules/party/party.routes.js";
import productRoutes from "./modules/product/product.routes.js";
import batchRoutes from "./modules/batch/batch.routes.js";
import invoiceRoutes from "./modules/invoice/invoice.routes.js";
import invoiceItemRoutes from "./modules/invoiceItem/invoiceItem.routes.js";
import organizationMemberRoutes from "./modules/organizationMember/member.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";
import stockMovementRoutes from "./modules/stockMovement/movement.routes.js";
import accountingRoutes from "./modules/accounting/ledger.routes.js";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";

const app = express();
app.set("trust proxy", env.trustProxy);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  handler: (req, res, next, options) => {
    throw new AppError(options.message, HTTP_STATUS.TOO_MANY_REQUESTS);
  },
});

app.use("/api", limiter);
app.use(express.json({ limit: "1mb" }));

// ------------- مسیر های اصلی برنامه (API Routes) -------------

app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/organizations", organizationRoutes);
app.use("/api/v1", organizationMemberRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", stockMovementRoutes);
app.use("/api/v1", accountingRoutes);

app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/health/ready", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready", database: "connected" });
  } catch (error) { next(error); }
});
app.use("/api/v1/users", userRoutes);
app.use("/api/v1", partyRoutes);
app.use("/api/v1", productRoutes);
app.use("/api/v1", batchRoutes);
app.use("/api/v1", invoiceRoutes);
app.use("/api/v1", invoiceItemRoutes);

// Error 404 Route Handler
app.use((req, _res, next) => {
  next(new AppError(`Can not find ${req.originalUrl} on this server!`, HTTP_STATUS.NOT_FOUND));
});

app.use(errorHandler);

export default app;
