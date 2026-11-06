import { InvoiceStatus, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";

const recalculateTotal = async (tx: Prisma.TransactionClient, invoiceId: string) => {
  const [items, invoice] = await Promise.all([
    tx.invoiceItem.findMany({ where: { invoiceId }, select: { quantity: true, unitPrice: true } }),
    tx.invoice.findUnique({ where: { id: invoiceId }, select: { discountAmount: true, taxAmount: true, otherCharges: true } }),
  ]);
  if (!invoice) throw new AppError("Invoice not found", 404);
  const subtotal = items.reduce((total, item) => total.add(item.quantity.mul(item.unitPrice)), new Prisma.Decimal(0));
  if (invoice.discountAmount.gt(subtotal)) throw new AppError("Discount cannot exceed the invoice subtotal", 409);
  const totalAmount = subtotal.sub(invoice.discountAmount).add(invoice.taxAmount).add(invoice.otherCharges);
  await tx.invoice.update({ where: { id: invoiceId }, data: { totalAmount } });
};
const requireInvoice = async (organizationId: string, invoiceId: string) => {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!invoice) throw new AppError("Invoice not found in this organization", 404);
  return invoice;
};
const requireDraftInvoice = async (organizationId: string, invoiceId: string) => {
  const invoice = await requireInvoice(organizationId, invoiceId);
  if (invoice.status !== InvoiceStatus.DRAFT) throw new AppError("Only draft invoices can be changed", 409);
  return invoice;
};
const requireProduct = async (organizationId: string, productId: string) => {
  if (!(await prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } }))) {
    throw new AppError("Product not found in this organization", 400);
  }
};
export const listInvoiceItems = async (userId: string, organizationId: string, invoiceId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  await requireInvoice(organizationId, invoiceId);
  const [items, total] = await Promise.all([
    prisma.invoiceItem.findMany({ where: { invoiceId, organizationId }, include: { product: true }, orderBy: { id: "asc" }, skip: pagination.skip, take: pagination.take }),
    prisma.invoiceItem.count({ where: { invoiceId, organizationId } }),
  ]);
  return paginatedResult(items, total, pagination);
};
export const getInvoiceItem = async (userId: string, organizationId: string, invoiceId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const item = await prisma.invoiceItem.findFirst({ where: { id, invoiceId }, include: { product: true, invoice: true } });
  if (!item || item.invoice.organizationId !== organizationId) throw new AppError("Invoice item not found", 404);
  return item;
};
export const createInvoiceItem = async (userId: string, organizationId: string, invoiceId: string, input: { productId: string; quantity: number; unitPrice: number }) => {
  await requireOrganizationMember(userId, organizationId);
  await requireDraftInvoice(organizationId, invoiceId);
  await requireProduct(organizationId, input.productId);
  try {
    return await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { status: true } });
      if (!currentInvoice || currentInvoice.status !== InvoiceStatus.DRAFT) throw new AppError("Only draft invoices can be changed", 409);
      const item = await tx.invoiceItem.create({ data: { ...input, invoiceId, organizationId }, include: { product: true } });
      await recalculateTotal(tx, invoiceId);
      return item;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Invoice item"); }
};
export const updateInvoiceItem = async (userId: string, organizationId: string, invoiceId: string, id: string, input: { productId?: string; quantity?: number; unitPrice?: number }) => {
  await requireOrganizationMember(userId, organizationId);
  const invoice = await requireDraftInvoice(organizationId, invoiceId);
  const current = await prisma.invoiceItem.findFirst({ where: { id, invoiceId } });
  if (!current) throw new AppError("Invoice item not found", 404);
  if (invoice.type === "PURCHASE" && (input.productId !== undefined || input.quantity !== undefined)) {
    const productIds = [...new Set([current.productId, input.productId ?? current.productId])];
    const batchCount = await prisma.batch.count({ where: { invoiceId, productId: { in: productIds } } });
    if (batchCount > 0) throw new AppError("Remove related batches before changing purchased products or quantities", 409);
  }
  if (input.productId) await requireProduct(organizationId, input.productId);
  try {
    return await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { status: true } });
      if (!currentInvoice || currentInvoice.status !== InvoiceStatus.DRAFT) throw new AppError("Only draft invoices can be changed", 409);
      if (invoice.type === "PURCHASE" && (input.productId !== undefined || input.quantity !== undefined)) {
        const productIds = [...new Set([current.productId, input.productId ?? current.productId])];
        if (await tx.batch.count({ where: { invoiceId, productId: { in: productIds } } })) throw new AppError("Remove related batches before changing purchased products or quantities", 409);
      }
      const item = await tx.invoiceItem.update({ where: { id }, data: input, include: { product: true } });
      await recalculateTotal(tx, invoiceId);
      return item;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Invoice item"); }
};
export const deleteInvoiceItem = async (userId: string, organizationId: string, invoiceId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const invoice = await requireDraftInvoice(organizationId, invoiceId);
  const item = await prisma.invoiceItem.findFirst({ where: { id, invoiceId } });
  if (!item) throw new AppError("Invoice item not found", 404);
  if (invoice.type === "PURCHASE" && await prisma.batch.count({ where: { invoiceId, productId: item.productId } })) {
    throw new AppError("Remove related batches before deleting this purchased item", 409);
  }
  await prisma.$transaction(async (tx) => {
    const currentInvoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { status: true } });
    if (!currentInvoice || currentInvoice.status !== InvoiceStatus.DRAFT) throw new AppError("Only draft invoices can be changed", 409);
    if (invoice.type === "PURCHASE" && await tx.batch.count({ where: { invoiceId, productId: item.productId } })) {
      throw new AppError("Remove related batches before deleting this purchased item", 409);
    }
    await tx.invoiceItem.delete({ where: { id } });
    await recalculateTotal(tx, invoiceId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};
