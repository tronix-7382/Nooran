import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/error.middlewares.js";
import { AppError } from "./utils/appError.js";
import { logger } from "./utils/logger.js";
import { HTTP_STATUS } from "./constants/httpStatus.js";

dotenv.config();
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:2026"],
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
app.use(express.json());

// ------------- مسیر های اصلی برنامه (API Routes) -------------

// Error 404 Route Handler
app.use((req, _res, next) => {
  next(new AppError(`Can not find ${req.originalUrl} on this server!`, HTTP_STATUS.NOT_FOUND));
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
