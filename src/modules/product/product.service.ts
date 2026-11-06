import { Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";

const attachStock = async <T extends { id: string }>(organizationId: string, products: T[]) => {
  const totals = await prisma.batch.groupBy({
    by: ["productId"],
    where: { organizationId, remainingQuantity: { gt: 0 }, invoice: { is: { status: "FINAL" } } },
    _sum: { remainingQuantity: true },
  });
  const stockByProduct = new Map(totals.map((row) => [row.productId, row._sum.remainingQuantity ?? new Prisma.Decimal(0)]));
  return products.map((product) => ({ totalStock: stockByProduct.get(product.id) ?? new Prisma.Decimal(0), ...product }));
};

export const listProducts = async (userId: string, organizationId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where: { organizationId }, orderBy: { name: "asc" }, skip: pagination.skip, take: pagination.take }),
    prisma.product.count({ where: { organizationId } }),
  ]);
  return paginatedResult(await attachStock(organizationId, products), total, pagination);
};

export const getProduct = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const product = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!product) throw new AppError("Product not found", 404);
  return (await attachStock(organizationId, [product]))[0];
};

export const createProduct = async (userId: string, organizationId: string, input: Record<string, unknown>) => {
  await requireOrganizationMember(userId, organizationId);
  const data = { ...input, organizationId, ...(input.sku === "" ? { sku: null } : {}) };
  try { return await prisma.product.create({ data: data as never }); }
  catch (error) { return handlePrismaError(error, "Product"); }
};

export const updateProduct = async (userId: string, organizationId: string, id: string, input: Record<string, unknown>) => {
  await requireOrganizationMember(userId, organizationId);
  const product = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!product) throw new AppError("Product not found", 404);
  const data = { ...input, ...(input.sku === "" ? { sku: null } : {}) };
  try {
    const updated = await prisma.product.update({ where: { id }, data: data as never });
    return (await attachStock(organizationId, [updated]))[0];
  } catch (error) { return handlePrismaError(error, "Product"); }
};

export const deleteProduct = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const product = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!product) throw new AppError("Product not found", 404);
  const [batches, items, movements] = await Promise.all([
    prisma.batch.count({ where: { productId: id, organizationId } }),
    prisma.invoiceItem.count({ where: { productId: id, organizationId } }),
    prisma.stockMovement.count({ where: { productId: id, organizationId } }),
  ]);
  if (batches + items + movements > 0) throw new AppError("Product has accounting or inventory history and cannot be deleted", 409);
  await prisma.product.delete({ where: { id } });
};
