import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";
import { logger } from "../utils/logger.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import resMessage from "../utils/resMes.js";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    err.status === HTTP_STATUS.BAD_REQUEST &&
    "body" in err
  ) {
    err = new AppError(
      "Invalid JSON format or malformed request body.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  if (err instanceof AppError) {
    logger.warn(
      `Operational Error: ${err.message} - Path: ${req.originalUrl} - Method: ${req.method}`,
    );
    return res.status(err.statusCode).json(resMessage(false, err.message));
  }

  logger.error(
    `Unexpected Error: ${err.message} - Path: ${req.originalUrl} - Method: ${req.method} - Stack: ${err.stack}`,
  );
  return res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json(resMessage(false, "خطای داخلی سرور رخ داده است."));
};
