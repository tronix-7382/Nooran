import { Request, Response, NextFunction } from "express";
import { ZodError, ZodObject } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import resMessage from "../utils/resMes.js";

export const validate = (schema: ZodObject<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      console.log(await schema.parseAsync(req.body))
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(resMessage(false, "Validation error", error.flatten().fieldErrors));
      }
      next(error);
    }
  };
};
