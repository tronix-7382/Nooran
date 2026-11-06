import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createBatchController, deleteBatchController, getBatchController, listBatchesController, updateBatchController } from "./batch.controller.js";
import { createBatchSchema, updateBatchSchema } from "./batch.validation.js";

const router = Router();

router.use(authenticate);
router.post("/organizations/:organizationId/batches", validate(createBatchSchema), createBatchController);
router.get("/organizations/:organizationId/batches", listBatchesController);
router.get("/organizations/:organizationId/batches/:batchId", getBatchController);
router.patch("/organizations/:organizationId/batches/:batchId", validate(updateBatchSchema), updateBatchController);
router.delete("/organizations/:organizationId/batches/:batchId", deleteBatchController);

export default router;
