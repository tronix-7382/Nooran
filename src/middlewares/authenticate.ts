import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import resMessage from "../utils/resMes.js";
import prisma from "../lib/prisma.js";

export const authenticate = async (
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

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(resMessage(false, "Invalid or expired token"));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, systemRole: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(resMessage(false, "User account is unavailable"));
    }

    req.user = {
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    };
    next();
  } catch (error) {
    next(error);
  }
};
