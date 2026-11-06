import { InvoiceStatus, InvoiceType, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";
import { postJournalEntry } from "../accounting/ledger.service.js";

const invoiceInclude = { party: true, items: { include: { product: true } }, payments: true } as const;
type InvoiceInput = {
  partyId?: string;
  invoiceNumber?: string;
  type?: "PURCHASE" | "SALE";
  status?: "DRAFT" | "FINAL" | "CANCELLED";
  discountAmount?: number;
  taxAmount?: number;
  otherCharges?: number;
  currencyCode?: string;
};

const computeTotal = (items: { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal }[], discount: Prisma.Decimal, tax: Prisma.Decimal, charges: Prisma.Decimal) => {
  const subtotal = items.reduce((sum, item) => sum.add(item.quantity.mul(item.unitPrice)), new Prisma.Decimal(0));
  if (discount.gt(subtotal)) throw new AppError("Discount cannot exceed the invoice subtotal", 400);
  return subtotal.sub(discount).add(tax).add(charges);
};

const nextInvoiceNumber = async (tx: Prisma.TransactionClient, organizationId: string, type: InvoiceType, year: number) => {
  const counter = await tx.invoiceSequence.upsert({
    where: { organizationId_year_type: { organizationId, year, type } },
    create: { organizationId, year, type, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  const prefix = type === InvoiceType.PURCHASE ? "PUR" : "SAL";
  return `${prefix}-${year}-${String(counter.nextNumber - 1).padStart(6, "0")}`;
};

const withPaymentSummary = (invoice: any) => {
  const paidAmount = invoice.payments
    .filter((payment: any) => payment.status === "ACTIVE")
    .reduce((sum: Prisma.Decimal, payment: any) => sum.add(payment.amount), new Prisma.Decimal(0));
  return {
    ...invoice,
    paidAmount,
    balanceDue: invoice.totalAmount.sub(paidAmount),
    paymentStatus: paidAmount.eq(0) ? "UNPAID" : paidAmount.gte(invoice.totalAmount) ? "PAID" : "PARTIALLY_PAID",
  };
};

export const listInvoices = async (userId: string, organizationId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({ where: { organizationId }, include: invoiceInclude, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.invoice.count({ where: { organizationId } }),
  ]);
  return paginatedResult(rows.map(withPaymentSummary), total, pagination);
};

export const getInvoice = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const invoice = await prisma.invoice.findFirst({ where: { id, organizationId }, include: invoiceInclude });
  if (!invoice) throw new AppError("Invoice not found", 404);
  return withPaymentSummary(invoice);
};

export const createInvoice = async (userId: string, organizationId: string, input: {
  partyId: string; invoiceNumber?: string; type?: "PURCHASE" | "SALE"; discountAmount?: number;
  taxAmount?: number; otherCharges?: number; currencyCode?: string;
}) => {
  await requireOrganizationMember(userId, organizationId);
  const type = input.type ?? InvoiceType.PURCHASE;
  const party = await prisma.party.findFirst({ where: { id: input.partyId, organizationId } });
  if (!party) throw new AppError("Party not found in this organization", 400);
  if (type === InvoiceType.PURCHASE && party.type !== "SUPPLIER") throw new AppError("Purchase invoices require a supplier party", 400);
  if (type === InvoiceType.SALE && party.type !== "CUSTOMER") throw new AppError("Sales invoices require a customer party", 400);

  try {
    return await prisma.$transaction(async (tx) => {
      const invoiceNumber = input.invoiceNumber ?? await nextInvoiceNumber(tx, organizationId, type, new Date().getFullYear());
      return tx.invoice.create({
        data: {
          organizationId,
          partyId: input.partyId,
          invoiceNumber,
          createdByUserId: userId,
          type,
          discountAmount: input.discountAmount ?? 0,
          taxAmount: input.taxAmount ?? 0,
          otherCharges: input.otherCharges ?? 0,
          currencyCode: input.currencyCode ?? "IRR",
        },
        include: invoiceInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Invoice"); }
};

const recordStockMovement = async (tx: Prisma.TransactionClient, movement: {
  organizationId: string; productId: string; batchId: string; invoiceId: string; invoiceItemId: string;
  createdByUserId: string; type: "PURCHASE_IN" | "SALE_OUT" | "REVERSAL_IN" | "REVERSAL_OUT"; quantity: Prisma.Decimal;
  unitCost?: Prisma.Decimal; unitPrice?: Prisma.Decimal;
}) => tx.stockMovement.create({ data: movement });

export const updateInvoice = async (userId: string, organizationId: string, id: string, input: InvoiceInput) => {
  await requireOrganizationMember(userId, organizationId);
  const current = await prisma.invoice.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { items: true, batches: true } }, payments: { where: { status: "ACTIVE" } } },
  });
  if (!current) throw new AppError("Invoice not found", 404);
  if (current.status === InvoiceStatus.FINAL && input.status === InvoiceStatus.CANCELLED) {
    if (current.payments.length > 0) throw new AppError("Reverse active payments before cancelling a final invoice", 409);
    try {
      return await prisma.$transaction(async (tx) => {
        const lockedInvoice = await tx.invoice.findFirst({ where: { id, organizationId } });
        if (!lockedInvoice || lockedInvoice.status !== InvoiceStatus.FINAL) throw new AppError("Invoice is no longer final", 409);
        const activePayment = await tx.payment.findFirst({ where: { invoiceId: id, organizationId, status: "ACTIVE" }, select: { id: true } });
        if (activePayment) throw new AppError("Reverse active payments before cancelling a final invoice", 409);
        const movements = await tx.stockMovement.findMany({ where: { invoiceId: id, organizationId, type: "SALE_OUT" }, include: { batch: true, invoiceItem: true } });
        if (current.type === InvoiceType.PURCHASE) {
          const batches = await tx.batch.findMany({ where: { invoiceId: id, organizationId } });
          if (batches.some((batch) => !batch.remainingQuantity.equals(batch.initialQuantity))) {
            throw new AppError("Purchased inventory has been consumed; use a supplier return workflow before cancelling", 409);
          }
          const purchaseMovements = await tx.stockMovement.findMany({ where: { invoiceId: id, organizationId, type: "PURCHASE_IN" } });
          if (batches.length > 0 && (purchaseMovements.length !== batches.length || batches.some((batch) => !purchaseMovements.some((movement) => movement.batchId === batch.id)))) {
            throw new AppError("Purchase stock history is incomplete; invoice cannot be safely cancelled", 409);
          }
          for (const batch of batches) {
            const sourceMovement = purchaseMovements.find((movement) => movement.batchId === batch.id);
            if (!sourceMovement) continue;
            await tx.batch.update({ where: { id: batch.id }, data: { remainingQuantity: 0 } });
            await recordStockMovement(tx, {
              organizationId, productId: batch.productId, batchId: batch.id, invoiceId: id,
              invoiceItemId: sourceMovement.invoiceItemId, createdByUserId: userId, type: "REVERSAL_OUT",
              quantity: batch.initialQuantity, unitCost: batch.purchasePrice,
            });
          }
        } else {
          const sourceItems = await tx.invoiceItem.findMany({ where: { invoiceId: id } });
          const recordedByItem = new Map<string, Prisma.Decimal>();
          for (const movement of movements) recordedByItem.set(movement.invoiceItemId, (recordedByItem.get(movement.invoiceItemId) ?? new Prisma.Decimal(0)).add(movement.quantity));
          if (sourceItems.some((item) => !(recordedByItem.get(item.id)?.equals(item.quantity))) || movements.length === 0) {
            throw new AppError("Sales stock history is incomplete; invoice cannot be safely cancelled", 409);
          }
          for (const movement of movements) {
            await tx.batch.update({ where: { id: movement.batchId }, data: { remainingQuantity: movement.batch.remainingQuantity.add(movement.quantity) } });
            await recordStockMovement(tx, {
              organizationId, productId: movement.productId, batchId: movement.batchId, invoiceId: id,
              invoiceItemId: movement.invoiceItemId, createdByUserId: userId, type: "REVERSAL_IN",
              quantity: movement.quantity,
              ...(movement.unitCost ? { unitCost: movement.unitCost } : {}),
              ...(movement.unitPrice ? { unitPrice: movement.unitPrice } : {}),
            });
          }
        }

        const sourceType = current.type === InvoiceType.PURCHASE ? "INVOICE_PURCHASE" : "INVOICE_SALE";
        const sourceEntry = await tx.journalEntry.findUnique({
          where: { organizationId_sourceType_sourceId: { organizationId, sourceType, sourceId: id } },
          include: { lines: { include: { account: true } } },
        });
        if (sourceEntry) {
          await postJournalEntry(tx, {
            organizationId, createdByUserId: userId, sourceType: "INVOICE_REVERSAL", sourceId: id,
            description: `Reversal of invoice ${current.invoiceNumber}`, currencyCode: current.currencyCode,
            lines: sourceEntry.lines.map((line) => ({ accountCode: line.account.code, debit: line.credit, credit: line.debit })),
          });
        }
        const cancelled = await tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED }, include: invoiceInclude });
        return withPaymentSummary(cancelled);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { return handlePrismaError(error, "Invoice"); }
  }
  if (current.status !== InvoiceStatus.DRAFT) throw new AppError("Only draft invoices can be edited; final invoices can only be cancelled", 409);
  if (input.type && input.type !== current.type && current._count.items > 0) throw new AppError("Invoice type cannot change after items are added", 409);
  const nextType = input.type ?? current.type;
  const partyId = input.partyId ?? current.partyId;
  if (input.partyId || input.type) {
    const party = await prisma.party.findFirst({ where: { id: partyId, organizationId } });
    if (!party) throw new AppError("Party not found in this organization", 400);
    if (nextType === InvoiceType.PURCHASE && party.type !== "SUPPLIER") throw new AppError("Purchase invoices require a supplier party", 400);
    if (nextType === InvoiceType.SALE && party.type !== "CUSTOMER") throw new AppError("Sales invoices require a customer party", 400);
  }

  const targetStatus = input.status ?? InvoiceStatus.DRAFT;
  if (targetStatus === InvoiceStatus.FINAL && current._count.items === 0) throw new AppError("An invoice needs at least one item before finalizing", 409);
  if (targetStatus === InvoiceStatus.CANCELLED && current._count.batches > 0) throw new AppError("Remove or reverse inventory batches before cancelling this invoice", 409);

  try {
    return await prisma.$transaction(async (tx) => {
      const items = await tx.invoiceItem.findMany({ where: { invoiceId: id }, select: { id: true, productId: true, quantity: true, unitPrice: true } });
      const discount = new Prisma.Decimal(input.discountAmount ?? current.discountAmount);
      const tax = new Prisma.Decimal(input.taxAmount ?? current.taxAmount);
      const charges = new Prisma.Decimal(input.otherCharges ?? current.otherCharges);
      const totalAmount = computeTotal(items, discount, tax, charges);

      if (targetStatus === InvoiceStatus.FINAL && current.type === InvoiceType.PURCHASE) {
        const itemTotals = await tx.invoiceItem.groupBy({ by: ["productId"], where: { invoiceId: id }, _sum: { quantity: true } });
        const batchTotals = await tx.batch.groupBy({ by: ["productId"], where: { invoiceId: id }, _sum: { initialQuantity: true } });
        for (const productId of new Set([...itemTotals.map((row) => row.productId), ...batchTotals.map((row) => row.productId)])) {
          const itemQuantity = itemTotals.find((row) => row.productId === productId)?._sum.quantity ?? new Prisma.Decimal(0);
          const batchQuantity = batchTotals.find((row) => row.productId === productId)?._sum.initialQuantity ?? new Prisma.Decimal(0);
          if (!itemQuantity.equals(batchQuantity)) throw new AppError("Purchase invoice quantities must match their inventory batches before finalizing", 409);
        }
        const batches = await tx.batch.findMany({ where: { invoiceId: id } });
        for (const batch of batches) {
          const sourceItem = items.find((item) => item.productId === batch.productId);
          if (!sourceItem) throw new AppError("Every purchase batch must match an invoice item", 409);
          await recordStockMovement(tx, {
            organizationId, productId: batch.productId, batchId: batch.id, invoiceId: id,
            invoiceItemId: sourceItem.id,
            createdByUserId: userId, type: "PURCHASE_IN", quantity: batch.initialQuantity, unitCost: batch.purchasePrice,
          });
        }
        if (totalAmount.gt(0)) {
          await postJournalEntry(tx, {
            organizationId, createdByUserId: userId, sourceType: "INVOICE_PURCHASE", sourceId: id,
            description: `Purchase invoice ${current.invoiceNumber}`, currencyCode: input.currencyCode ?? current.currencyCode,
            lines: [
              { accountCode: "1200", debit: totalAmount },
              { accountCode: "2000", credit: totalAmount },
            ],
          });
        }
      }

      if (targetStatus === InvoiceStatus.FINAL && current.type === InvoiceType.SALE) {
        let costOfGoodsSold = new Prisma.Decimal(0);
        for (const item of items) {
          let remaining = item.quantity;
          const batches = await tx.batch.findMany({
            where: { organizationId, productId: item.productId, remainingQuantity: { gt: 0 }, invoice: { is: { status: InvoiceStatus.FINAL } } },
            orderBy: [{ expireDate: "asc" }, { createdAt: "asc" }],
          });
          for (const batch of batches) {
            if (remaining.lte(0)) break;
            const quantity = Prisma.Decimal.min(remaining, batch.remainingQuantity);
            await tx.batch.update({ where: { id: batch.id }, data: { remainingQuantity: batch.remainingQuantity.sub(quantity) } });
            await recordStockMovement(tx, {
              organizationId, productId: item.productId, batchId: batch.id, invoiceId: id, invoiceItemId: item.id,
              createdByUserId: userId, type: "SALE_OUT", quantity, unitCost: batch.purchasePrice, unitPrice: item.unitPrice,
            });
            costOfGoodsSold = costOfGoodsSold.add(quantity.mul(batch.purchasePrice));
            remaining = remaining.sub(quantity);
          }
          if (remaining.gt(0)) throw new AppError("Not enough inventory to finalize this sales invoice", 409);
        }
        if (totalAmount.gt(0) || costOfGoodsSold.gt(0)) {
          const subtotal = items.reduce((sum, item) => sum.add(item.quantity.mul(item.unitPrice)), new Prisma.Decimal(0));
          const lines = [
            { accountCode: "1100", debit: totalAmount },
            { accountCode: "4000", credit: subtotal },
            { accountCode: "4010", debit: discount },
            { accountCode: "2100", credit: tax },
            { accountCode: "4100", credit: charges },
            { accountCode: "5000", debit: costOfGoodsSold },
            { accountCode: "1200", credit: costOfGoodsSold },
          ];
          await postJournalEntry(tx, {
            organizationId, createdByUserId: userId, sourceType: "INVOICE_SALE", sourceId: id,
            description: `Sales invoice ${current.invoiceNumber}`, currencyCode: input.currencyCode ?? current.currencyCode,
            lines,
          });
        }
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(input.partyId !== undefined ? { partyId: input.partyId } : {}),
          ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.discountAmount !== undefined ? { discountAmount: discount } : {}),
          ...(input.taxAmount !== undefined ? { taxAmount: tax } : {}),
          ...(input.otherCharges !== undefined ? { otherCharges: charges } : {}),
          ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          totalAmount,
        },
        include: invoiceInclude,
      });
      return withPaymentSummary(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Invoice"); }
};

export const deleteInvoice = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const current = await prisma.invoice.findFirst({ where: { id, organizationId }, select: { status: true, _count: { select: { batches: true, payments: true } } } });
  if (!current) throw new AppError("Invoice not found", 404);
  if (current.status !== InvoiceStatus.DRAFT || current._count.batches > 0 || current._count.payments > 0) {
    throw new AppError("Only draft invoices without inventory batches or payments can be deleted", 409);
  }
  try { await prisma.invoice.delete({ where: { id } }); }
  catch (error) { return handlePrismaError(error, "Invoice"); }
};
