import { asyncHandler, requestOrganizationId, requestPagination, requestResourceId, requestUserId } from "../shared/module.helpers.js";
import resMessage from "../../utils/resMes.js";
import { createBatch, deleteBatch, getBatch, listBatches, updateBatch } from "./batch.service.js";
export const listBatchesController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Batches retrieved successfully", await listBatches(requestUserId(req), requestOrganizationId(req), requestPagination(req)))));
export const getBatchController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Batch retrieved successfully", await getBatch(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "batchId")))));
export const createBatchController = asyncHandler(async (req, res) => res.status(201).json(resMessage(true, "Batch created successfully", await createBatch(requestUserId(req), requestOrganizationId(req), req.body))));
export const updateBatchController = asyncHandler(async (req, res) => res.status(200).json(resMessage(true, "Batch updated successfully", await updateBatch(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "batchId"), req.body))));
export const deleteBatchController = asyncHandler(async (req, res) => { await deleteBatch(requestUserId(req), requestOrganizationId(req), requestResourceId(req, "batchId")); res.status(200).json(resMessage(true, "Batch deleted successfully")); });
