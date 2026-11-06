import { NextFunction, Request, Response } from "express";
import { loginUser, registerUser } from "./auth.service.js";
import resMessage from "../../utils/resMes.js";
import { refreshAccessToken } from "../../utils/jwt.js";
import { requestUserId } from "../shared/module.helpers.js";
import {
  changePassword,
  logout as logoutUser,
  requestPasswordReset,
  resetPassword as resetUserPassword,
  sendPhoneVerificationCode,
  verifyPhoneCode,
} from "./security.service.js";

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registerUser(req.body);

    res
      .status(201)
      .json(resMessage(true, "User registered successfully", result));
  } catch (error) {
    next(error)
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loginUser(req.body)

    res
      .status(200)
      .json(resMessage(true, "User logged in successfully", result));

  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);
    
    res.status(200).json(resMessage(true, "Access token refreshed successfully", result));
  } catch (error) {
    next(error);
  }
}

export const changePasswordController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePassword(requestUserId(req), currentPassword, newPassword);
    res.status(200).json(resMessage(true, "Password changed successfully"));
  } catch (error) { next(error); }
};

export const logoutController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await logoutUser(requestUserId(req), req.body.refreshToken);
    res.status(200).json(resMessage(true, "Logged out successfully"));
  } catch (error) { next(error); }
};

export const forgotPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requestPasswordReset(req.body.email);
    res.status(200).json(resMessage(true, "If this email belongs to an active account, reset instructions will be sent."));
  } catch (error) { next(error); }
};

export const resetPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await resetUserPassword(req.body.token, req.body.newPassword);
    res.status(200).json(resMessage(true, "Password reset successfully. Please sign in again."));
  } catch (error) { next(error); }
};

export const sendPhoneCodeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await sendPhoneVerificationCode(requestUserId(req), req.body.phone);
    res.status(200).json(resMessage(true, "If the phone number is available, a verification code has been sent."));
  } catch (error) { next(error); }
};

export const verifyPhoneCodeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await verifyPhoneCode(requestUserId(req), req.body.code);
    res.status(200).json(resMessage(true, "Phone number verified successfully."));
  } catch (error) { next(error); }
};
