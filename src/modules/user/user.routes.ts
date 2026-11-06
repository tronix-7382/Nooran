import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  deleteUserController,
  getOwnUserController,
  getUserController,
  listUsersController,
  updateOwnUserController,
  updateUserController,
} from "./user.controller.js";
import { updateOwnUserSchema, updateUserSchema } from "./user.validation.js";

const router = Router();
router.use(authenticate);
router.get("/me", getOwnUserController);
router.patch("/me", validate(updateOwnUserSchema), updateOwnUserController);
router.use(authorize("ADMIN"));
router.get("/", listUsersController);
router.get("/:userId", getUserController);
router.patch("/:userId", validate(updateUserSchema), updateUserController);
router.delete("/:userId", deleteUserController);
export default router;
