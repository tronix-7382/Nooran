import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";
export const listStockMovements = async (userId: string, organizationId: string, pagination: Pagination, productId?: string) => {
  await requireOrganizationMember(userId, organizationId);
  if (productId && !(await prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } }))) throw new AppError("Product not found", 404);
  const where = { organizationId, ...(productId ? { productId } : {}) };
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({ where, include: { product: true, batch: true, invoice: true, invoiceItem: true, createdBy: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.stockMovement.count({ where }),
  ]);
  return paginatedResult(items, total, pagination);
};
export const getStockMovement = async (userId: string, organizationId: string, movementId: string) => {
  await requireOrganizationMember(userId, organizationId);
  const movement = await prisma.stockMovement.findFirst({ where: { id: movementId, organizationId }, include: { product: true, batch: true, invoice: true, invoiceItem: true } });
  if (!movement) throw new AppError("Stock movement not found", 404);
  return movement;
};
