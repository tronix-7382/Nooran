import { AppError } from "../../utils/appError.js";
import prisma from "../../lib/prisma.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";
import jwt from "jsonwebtoken";

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nationalId?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export const registerUser = async (input: RegisterInput) => {
  const { email, password, firstName, lastName, nationalId } = input;
  const jwtSecret = process.env.JWT_SECRET_KEY;

  if (!jwtSecret) {
    throw new AppError("JWT_SECRET is not configured properly", 500);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError("User with this email already exists", 400);
  }

  const hashedPassword = await hashPassword(password);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        nationalId: nationalId ?? null,
      },
    });

    // AccessToken
    const accessToken = signToken(
      {
        userId: user.id,
        email: user.email,
        systemRole: user.systemRole,
      },
      "15m" 
    );

    // RefreshToken
    const refreshToken = jwt.sign(
      { userId: user.id }, 
      jwtSecret,
      { expiresIn: "7d" }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await tx.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  });
};

export const loginUser = async (input: LoginInput) => {
  const jwtSecret = process.env.JWT_SECRET_KEY;

  if (!jwtSecret) {
    throw new AppError("JWT_SECRET is not configured properly", 500);
  }

  const { email, password } = input;

  if (!email || !password) {
    throw new AppError("Missing required fields", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordCorrect = await comparePassword(password, user.password);

  if (!isPasswordCorrect) {
    throw new AppError("Invalid email or password", 401);
  }

 // AccessToken
  const accessToken = signToken(
    {
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    },
    "15m" 
  );

  // RefreshToken
  const refreshToken = jwt.sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn: "7d" }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
};
