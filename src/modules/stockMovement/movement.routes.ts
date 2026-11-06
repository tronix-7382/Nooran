import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { getStockMovementController, listStockMovementsController } from "./movement.controller.js";
const router = Router();
router.use(authenticate);
router.get("/organizations/:organizationId/stock-movements", listStockMovementsController);
router.get("/organizations/:organizationId/stock-movements/:movementId", getStockMovementController);
export default router;
