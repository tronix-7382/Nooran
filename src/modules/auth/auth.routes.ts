import { Router } from 'express';
import { register, login, refreshToken, changePasswordController, logoutController, forgotPasswordController, resetPasswordController, sendPhoneCodeController, verifyPhoneCodeController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/authenticate.js';
import rateLimit from "express-rate-limit";
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, logoutSchema,
  refreshTokenSchema, registerSchema, resetPasswordSchema,
  sendPhoneCodeSchema, verifyPhoneCodeSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
router.post('/logout', authenticate, validate(logoutSchema), logoutController);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePasswordController);

const recoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const phoneCodeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
router.post('/forgot-password', recoveryLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password', recoveryLimiter, validate(resetPasswordSchema), resetPasswordController);
router.post('/phone/send-code', authenticate, phoneCodeLimiter, validate(sendPhoneCodeSchema), sendPhoneCodeController);
router.post('/phone/verify-code', authenticate, phoneCodeLimiter, validate(verifyPhoneCodeSchema), verifyPhoneCodeController);

export default router;

