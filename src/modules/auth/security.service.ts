import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { sendNotification } from "../../utils/notification.js";
import { handlePrismaError } from "../shared/module.helpers.js";

const hashValue = (value: string) => createHash("sha256").update(value).digest("hex");
const codeHash = (userId: string, phone: string, code: string) => {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) throw new AppError("JWT secret key is not configured", 500);
  return createHmac("sha256", secret).update(`${userId}:${phone}:${code}`).digest("hex");
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError("User account is unavailable", 401);
  if (!(await comparePassword(currentPassword, user.password))) throw new AppError("Current password is incorrect", 400);
  const password = await hashPasswo```rd(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } });
  if (!user || !user.isActive) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashValue(token);
  const resetUrl = process.env.PASSWORD_RESET_URL;
  if (!resetUrl && process.env.NODE_ENV === "production") throw new AppError("Password reset delivery is not configured", 503);
  const resetLink = `${(resetUrl ?? "http://localhost:3000/reset-password").replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
  });
  await sendNotification("EMAIL", user.email, `Reset your Nooran password using this one-time link: ${resetLink}`);
};

export const resetPassword = async (token: string, newPassword: string) => {
  const tokenHash = hashValue(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.expiresAt <= new Date()) {
    if (record) await prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
    throw new AppError("Password reset link is invalid or expired", 400);
  }

  const password = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.deleteMany({ where: { id: record.id, tokenHash, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new AppError("Password reset link is invalid or expired", 400);
    await tx.user.update({ where: { id: record.userId }, data: { password } });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
  });
};

export const logout = async (userId: string, refreshToken: string) => {
  const result = await prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } });
  if (result.count === 0) throw new AppError("Refresh token is invalid or already revoked", 400);
};

export const sendPhoneVerificationCode = async (userId: string, phone: string) => {
  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (!currentUser) throw new AppError("User not found", 404);
  const usedByAnotherUser = await prisma.user.findFirst({ where: { phone, id: { not: userId } }, select: { id: true } });
  if (usedByAnotherUser) throw new AppError("Phone number is already in use", 409);

  const existing = await prisma.phoneVerificationCode.findUnique({ where: { userId } });
  if (existing && Date.now() - existing.lastSentAt.getTime() < 60_000) {
    throw new AppError("Wait before requesting another verification code", 429);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.phoneVerificationCode.upsert({
    where: { userId },
    create: { userId, phone, codeHash: codeHash(userId, phone, code), expiresAt },
    update: { phone, codeHash: codeHash(userId, phone, code), expiresAt, attempts: 0, lastSentAt: new Date() },
  });

  try {
    await sendNotification("SMS", phone, `Your Nooran verification code is ${code}. It expires in 10 minutes.`);
  } catch (error) {
    await prisma.phoneVerificationCode.deleteMany({ where: { userId } });
    throw error;
  }
};

export const verifyPhoneCode = async (userId: string, code: string) => {
  const challenge = await prisma.phoneVerificationCode.findUnique({ where: { userId } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
    if (challenge) await prisma.phoneVerificationCode.delete({ where: { userId } });
    throw new AppError("Verification code is invalid or expired", 400);
  }

  const suppliedHash = Buffer.from(codeHash(userId, challenge.phone, code), "hex");
  const expectedHash = Buffer.from(challenge.codeHash, "hex");
  if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
    const attempts = challenge.attempts + 1;
    if (attempts >= 5) await prisma.phoneVerificationCode.delete({ where: { userId } });
    else await prisma.phoneVerificationCode.update({ where: { userId }, data: { attempts } });
    throw new AppError("Verification code is invalid", 400);
  }

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { phone: challenge.phone, phoneVerifiedAt: new Date() } }),
      prisma.phoneVerificationCode.delete({ where: { userId } }),
    ]);
  } catch (error) {
    return handlePrismaError(error, "Phone number");
  }
};
