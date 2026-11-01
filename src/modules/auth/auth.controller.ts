import { NextFunction, Request, Response } from "express";
import { loginUser, registerUser } from "./auth.service.js";
import resMessage from "../../utils/resMes.js";
import { refreshAccessToken } from "../../utils/jwt.js";

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
    
    res.json(resMessage(true, "Access token refreshed successfully", result));
  } catch (error) {
    next(error);
  }
}