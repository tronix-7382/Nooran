import {
  InvoiceStatus,
  InvoiceType,
  Prisma,
} from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import {
  handlePrismaError,
  paginatedResult,
  requireOrganizationMember,
  type Pagination,
} from "../shared/module.helpers.js";

export const listBatches = async (userId: string, organizationId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const [items, total] = await Promise.all([
    prisma.batch.findMany({ where: { organizationId }, include: { product: true, invoice: true }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.batch.count({ where: { organizationId } }),
  ]);
  return paginatedResult(items, total, pagination);
};

export const getBatch = async (
  userId: string,
  organizationId: string,
  id: string,
) => {
  await requireOrganizationMember(userId, organizationId);
  const row = await prisma.batch.findFirst({
    where: { id, organizationId },
    include: { product: true, invoice: true },
  });
  if (!row) throw new AppError("Batch not found", 404);
  return row;
};

const validateRefs = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  invoiceId: string,
) => {
  const [product, invoice] = await Promise.all([
    tx.product.findFirst({ where: { id: productId, organizationId } }),
    tx.invoice.findFirst({ where: { id: invoiceId, organizationId } }),
  ]);
  if (!product)
    throw new AppError("Product not found in this organization", 400);
  if (!invoice)
    throw new AppError("Invoice not found in this organization", 400);
  if (invoice.type !== InvoiceType.PURCHASE)
    throw new AppError(
      "Inventory batches must reference purchase invoices",
      400,
    );
  if (invoice.status !== InvoiceStatus.DRAFT)
    throw new AppError(
      "Batches can only be changed while the purchase invoice is a draft",
      409,
    );
  const purchased = await tx.invoiceItem.aggregate({
    where: { invoiceId, productId },
    _sum: { quantity: true },
  });
  if (!purchased._sum.quantity)
    throw new AppError(
      "Add this product to the purchase invoice before creating its batch",
      400,
    );
};

export const createBatch = async (
  userId: string,
  organizationId: string,
  input: {
    productId: string;
    invoiceId: string;
    purchasePrice: number;
    initialQuantity: number;
    remainingQuantity?: number;
    expireDate?: Date | null;
  },
) => {
  await requireOrganizationMember(userId, organizationId);
  try {
    return await prisma.$transaction(async (tx) => {
      await validateRefs(tx, organizationId, input.productId, input.invoiceId);
      const remainingQuantity = input.remainingQuantity ?? input.initialQuantity;
      if (new Prisma.Decimal(remainingQuantity).gt(input.initialQuantity)) throw new AppError("Remaining quantity cannot exceed initial quantity", 400);
      const [purchased, existing] = await Promise.all([
        tx.invoiceItem.aggregate({ where: { invoiceId: input.invoiceId, productId: input.productId }, _sum: { quantity: true } }),
        tx.batch.aggregate({ where: { invoiceId: input.invoiceId, productId: input.productId }, _sum: { initialQuantity: true } }),
      ]);
      const alreadyBatched = existing._sum.initialQuantity ?? new Prisma.Decimal(0);
      const purchasedQuantity = purchased._sum.quantity ?? new Prisma.Decimal(0);
      if (alreadyBatched.add(input.initialQuantity).gt(purchasedQuantity)) throw new AppError("Batch quantities cannot exceed the purchase invoice quantity for this product", 400);
      return tx.batch.create({ data: { ...input, remainingQuantity, organizationId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return handlePrismaError(error, "Batch");
  }
};

export const updateBatch = async (
  userId: string,
  organizationId: string,
  id: string,
  input: {
    purchasePrice?: number;
    initialQuantity?: number;
    remainingQuantity?: number;
    expireDate?: Date | null;
  },
) => {
  await requireOrganizationMember(userId, organizationId);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.batch.findFirst({ where: { id, organizationId }, include: { invoice: true } });
      if (!row) throw new AppError("Batch not found", 404);
      if (row.invoice.status !== InvoiceStatus.DRAFT) throw new AppError("Batches can only be changed while the purchase invoice is a draft", 409);
      const initialQuantity = input.initialQuantity ?? Number(row.initialQuantity);
      const remainingQuantity = input.remainingQuantity ?? Number(row.remainingQuantity);
      if (new Prisma.Decimal(remainingQuantity).gt(initialQuantity)) throw new AppError("Remaining quantity cannot exceed initial quantity", 400);
      const [purchased, otherBatches] = await Promise.all([
        tx.invoiceItem.aggregate({ where: { invoiceId: row.invoiceId, productId: row.productId }, _sum: { quantity: true } }),
        tx.batch.aggregate({ where: { invoiceId: row.invoiceId, productId: row.productId, NOT: { id } }, _sum: { initialQuantity: true } }),
      ]);
      const otherQuantity = otherBatches._sum.initialQuantity ?? new Prisma.Decimal(0);
      const purchasedQuantity = purchased._sum.quantity ?? new Prisma.Decimal(0);
      if (otherQuantity.add(initialQuantity).gt(purchasedQuantity)) throw new AppError("Batch quantities cannot exceed the purchase invoice quantity for this product", 400);
      return tx.batch.update({ where: { id }, data: { ...input, initialQuantity, remainingQuantity } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return handlePrismaError(error, "Batch");
  }
};

export const deleteBatch = async (
  userId: string,
  organizationId: string,
  id: string,
) => {
  await requireOrganizationMember(userId, organizationId);
  await prisma.$transaction(async (tx) => {
    const row = await tx.batch.findFirst({ where: { id, organizationId }, include: { invoice: true } });
    if (!row) throw new AppError("Batch not found", 404);
    if (row.invoice.status !== InvoiceStatus.DRAFT) throw new AppError("Batches can only be changed while the purchase invoice is a draft", 409);
    await tx.batch.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};
