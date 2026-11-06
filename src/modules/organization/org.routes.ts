import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createOrganizationController,
  deleteOrganizationController,
  listOrganizationsController,
  readOrganizationController,
  updateOrganizationController,
} from "./org.controller.js";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "./org.validation.js";

const router = Router();

router.use(authenticate);
router.post("/", validate(createOrganizationSchema), createOrganizationController);
router.get("/", listOrganizationsController);
router.get("/:organizationId", readOrganizationController);
router.patch("/:organizationId", validate(updateOrganizationSchema), updateOrganizationController);
router.delete("/:organizationId", deleteOrganizationController);

export default router;
