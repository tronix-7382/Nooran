import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { getStockMovement, listStockMovements } from "./movement.service.js";
export const listStockMovementsController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Stock movements retrieved successfully", await listStockMovements(requestUserId(req), requestOrganizationId(req), requestPagination(req), typeof req.query.productId === "string" ? req.query.productId : undefined))));
export const getStockMovementController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Stock movement retrieved successfully", await getStockMovement(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "movementId")))));
