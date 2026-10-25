import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import { logger } from "../utils/logger.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {

    // error handling for invalid JSON in request body from express.json() middleware
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === HTTP_STATUS.BAD_REQUEST &&
    "body" in err
  ) {
    err = new AppError("Invalid JSON format or malformed request body.", HTTP_STATUS.BAD_REQUEST);
  }

  // Handle AppError instances (operational errors)
  if (err instanceof AppError) {
    logger.warn(
      `Operational Error: ${err.message} - Path: ${req.originalUrl} - Method: ${req.method}`,
    );

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

 // Handle unexpected errors (programming errors)
  logger.error(
    `Unexpected Error: ${err.message} - Path: ${req.originalUrl} - Method: ${req.method} - Stack: ${err.stack}`,
  );

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: "خطای داخلی سرور رخ داده است.",
  });
};
