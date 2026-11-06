import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import resMessage from "../utils/resMes.js";

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(resMessage(false, "Unauthorized Access"));
    }

    // HELPER has no implicit platform-wide access. It may only use organization data
    // when the user also has an active OrganizationMember record for that tenant.
    if (!allowedRoles.includes(req.user.systemRole)) {
      return res
        .status(HTTP_STATUS.FORBIDDEN)
        .json(
          resMessage(
            false,
            "Forbidden: You do not have permission to access this resource",
          ),
        );
    }

    next();
  };
};
