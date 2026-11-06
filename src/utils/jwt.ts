import jwt from "jsonwebtoken";
import { AppError } from "./appError.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";

interface JwtPayload {
  userId: string;
  email: string;
  systemRole: string;
  tokenType?: "access" | "refresh";
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign({ ...payload, tokenType: "access" }, env.JWT_SECRET_KEY, {
    expiresIn: "15m",
  });
};

export const signRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, tokenType: "refresh" }, env.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as JwtPayload;
    if (
      !decoded ||
      decoded.tokenType !== "access" ||
      typeof decoded.userId !== "string"
    ) {
      throw new AppError("Invalid access token", 401);
    }
    return decoded;
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }
};

export const refreshAccessToken = async (refreshToken: string) => {

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_SECRET_KEY);
    if (
      !decoded ||
      decoded.tokenType !== "refresh" ||
      typeof decoded.userId !== "string"
    ) {
      throw new Error("Invalid token type");
    }
  } catch (error) {
    throw new AppError("Invalid or expired refresh token signature", 401);
  }

  const storedRefreshToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedRefreshToken || storedRefreshToken.userId !== decoded.userId) {
    throw new AppError("Invalid or revoked refresh token", 401);
  }

  if (storedRefreshToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    throw new AppError("Refresh token has expired", 401);
  }

  if (!storedRefreshToken.user.isActive)
    throw new AppError("User account is disabled", 401);

  const newAccessToken = signToken({
    userId: storedRefreshToken.user.id,
    email: storedRefreshToken.user.email,
    systemRole: storedRefreshToken.user.systemRole,
  });

  const newRefreshToken = signRefreshToken(storedRefreshToken.user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.deleteMany({
      where: { id: storedRefreshToken.id },
    });

    if (revoked.count !== 1)
      throw new AppError("Refresh token has already been used", 401);

    await tx.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedRefreshToken.userId,
        expiresAt,
      },
    });
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
