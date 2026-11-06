import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { OrganizationRole } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";

export const asyncHandler =
  (action: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void action(req, res).catch(next);
  };
  
export const requestUserId = (req: Request): string => {
  if (!req.user?.userId) throw new AppError("Authentication is required", 401);
  return req.user.userId;
};

export const requestOrganizationId = (req: Request): string => {
  const result = z.string().uuid().safeParse(req.params.organizationId);
  if (!result.success) throw new AppError("Invalid organization ID", 400);
  return result.data;
};

export const requestResourceId = (req: Request, key = "id"): string => {
  const result = z.string().uuid().safeParse(req.params[key]);
  if (!result.success) throw new AppError(`Invalid ${key}`, 400);
  return result.data;
};

export type Pagination = { page: number; pageSize: number; skip: number; take: number };
export const requestPagination = (req: Request): Pagination => {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);
  if (!parsed.success) throw new AppError("Invalid pagination parameters", 400);
  return { ...parsed.data, skip: (parsed.data.page - 1) * parsed.data.pageSize, take: parsed.data.pageSize };
};

export const paginatedResult = <T>(items: T[], totalItems: number, pagination: Pagination) => ({
  items,
  pagination: {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pagination.pageSize),
  },
});

export const requireOrganizationMember = async (
  userId: string,
  organizationId: string,
  ownerOnly = false,
) => {
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!member?.isActive) throw new AppError("Organization not found", 404);
  if (ownerOnly && member.role !== OrganizationRole.OWNER) {
    throw new AppError("Only an organization owner can perform this action", 403);
  }
  return member;
};

export const handlePrismaError = (error: unknown, label: string): never => {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    if (code === "P2002") throw new AppError(`${label} conflicts with an existing record`, 409);
    if (code === "P2003" || code === "P2014") {
      throw new AppError(`${label} is referenced by other records and cannot be deleted or changed`, 409);
    }
    if (code === "P2034") throw new AppError("Concurrent update detected. Retry the request.", 409);
    if (code === "P2025") throw new AppError(`${label} not found`, 404);
  }
  throw error;
};
