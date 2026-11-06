import type { NextFunction, Request, Response } from "express";
import resMessage from "../../utils/resMes.js";
import { AppError } from "../../utils/appError.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from "./org.service.js";
import {
  organizationIdSchema,
} from "./org.validation.js";
import { requestPagination } from "../shared/module.helpers.js";

const getUserId = (req: Request): string => {
  if (!req.user?.userId) throw new AppError("Authentication is required", 401);
  return req.user.userId;
};

const getOrganizationId = (req: Request): string => {
  const result = organizationIdSchema.safeParse(req.params.organizationId);
  if (!result.success) throw new AppError("Invalid organization ID", 400);
  return result.data;
};

const handle =
  (action: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void action(req, res).catch(next);
  };

export const createOrganizationController = handle(async (req, res) => {
  const organization = await createOrganization(getUserId(req), req.body);
  res.status(201).json(resMessage(true, "Organization created successfully", organization));
});

export const listOrganizationsController = handle(async (req, res) => {
  const organizations = await listOrganizations(getUserId(req), requestPagination(req));
  res.status(200).json(resMessage(true, "Organizations retrieved successfully", organizations));
});

export const readOrganizationController = handle(async (req, res) => {
  const organization = await getOrganization(getUserId(req), getOrganizationId(req));
  res.status(200).json(resMessage(true, "Organization retrieved successfully", organization));
});

export const updateOrganizationController = handle(async (req, res) => {
  const input = req.body;
  const organization = await updateOrganization(
    getUserId(req),
    getOrganizationId(req),
    input,
  );
  res.status(200).json(resMessage(true, "Organization updated successfully", organization));
});

export const deleteOrganizationController = handle(async (req, res) => {
  await deleteOrganization(getUserId(req), getOrganizationId(req));
  res.status(200).json(resMessage(true, "Organization deleted successfully"));
});
