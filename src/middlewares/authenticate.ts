import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import resMessage from "../utils/resMes.js";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(resMessage(false, "Authentication token is missing or invalid"));
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(resMessage(false, "Authentication token is missing"));
    }

    const decoded = verifyToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(resMessage(false, "Invalid or expired token"));
  }
};
