import jwt from "jsonwebtoken";
import { AppError } from "./appError.js";
import prisma from "../lib/prisma.js";

interface JwtPayload {
  userId: string;
  email: string;
  systemRole: string;
}

export const signToken = (payload: JwtPayload, expDate?: string): string => {
  const secretKey = process.env.JWT_SECRET_KEY;

  if (!secretKey) {
    throw new AppError(
      "JWT secret key is not defined in environment variables",
      500,
    );
  }

  return jwt.sign(payload, secretKey, { expiresIn: (expDate ?? "7d") as any });
};

export const verifyToken = (token: string): JwtPayload => {
  const secretKey = process.env.JWT_SECRET_KEY;

  if (!secretKey) {
    throw new AppError(
      "JWT secret key is not defined in environment variables",
      500,
    );
  }

  try {
    const decoded = jwt.verify(token, secretKey) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }
};

export const refreshAccessToken = async (refreshToken: string) => {
  const jwtSecret = process.env.JWT_SECRET_KEY;

  if (!jwtSecret) {
    throw new AppError(
      "JWT secret key is not defined in environment variables",
      500,
    );
  }

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

   try {
    jwt.verify(refreshToken, jwtSecret);
  } catch (error) {
    throw new AppError("Invalid or expired refresh token signature", 401);
  }

  const storedRefreshToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedRefreshToken) {
    throw new AppError("Refresh token not found", 404);
  }
 
  if (storedRefreshToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    throw new AppError("Refresh token has expired", 401);
  }

  const newAccessToken = jwt.sign(
    { userId: storedRefreshToken.user.id, email: storedRefreshToken.user.email, systemRole: storedRefreshToken.user.systemRole },
    jwtSecret,
    { expiresIn: "15m" },
  );

  return { accessToken: newAccessToken}
};
