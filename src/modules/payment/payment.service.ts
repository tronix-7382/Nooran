import { InvoiceStatus, PaymentStatus, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";
import { postJournalEntry } from "../accounting/ledger.service.js";

export const listPayments = async (userId: string, organizationId: string, invoiceId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId }, select: { id: true } });
  if (!invoice) throw new AppError("Invoice not found", 404);
  const where = { organizationId, invoiceId };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.take }),
    prisma.payment.count({ where }),
  ]);
  return paginatedResult(items, total, pagination);
};

export const createPayment = async (userId: string, organizationId: string, invoiceId: string, input: { amount: number; method: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER"; reference?: string }) => {
  await requireOrganizationMember(userId, organizationId);
  try {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId } });
      if (!invoice) throw new AppError("Invoice not found", 404);
      if (invoice.status !== InvoiceStatus.FINAL) throw new AppError("Payments can only be recorded for final invoices", 409);
      const activePayments = await tx.payment.aggregate({ where: { invoiceId, organizationId, status: PaymentStatus.ACTIVE }, _sum: { amount: true } });
      const paid = activePayments._sum.amount ?? new Prisma.Decimal(0);
      const due = invoice.totalAmount.sub(paid);
      const amount = new Prisma.Decimal(input.amount);
      if (amount.gt(due)) throw new AppError("Payment exceeds the invoice balance due", 400);
      const payment = await tx.payment.create({ data: { organizationId, invoiceId, createdByUserId: userId, ...input, amount } });
      const isSale = invoice.type === "SALE";
      await postJournalEntry(tx, {
        organizationId, createdByUserId: userId, sourceType: "PAYMENT", sourceId: payment.id,
        description: `${isSale ? "Customer receipt" : "Supplier payment"} for invoice ${invoice.invoiceNumber}`,
        currencyCode: invoice.currencyCode,
        lines: isSale
          ? [{ accountCode: "1000", debit: amount }, { accountCode: "1100", credit: amount }]
          : [{ accountCode: "2000", debit: amount }, { accountCode: "1000", credit: amount }],
      });
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Payment"); }
};

export const reversePayment = async (userId: string, organizationId: string, paymentId: string, reason: string) => {
  await requireOrganizationMember(userId, organizationId);
  try {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, organizationId, invoice: { is: { organizationId } } }, include: { invoice: true } });
      if (!payment) throw new AppError("Payment not found", 404);
      if (payment.status !== PaymentStatus.ACTIVE) throw new AppError("Payment has already been reversed", 409);
      const reversed = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REVERSED, reversedAt: new Date(), reversalReason: reason },
      });
      const isSale = payment.invoice.type === "SALE";
      await postJournalEntry(tx, {
        organizationId, createdByUserId: userId, sourceType: "PAYMENT_REVERSAL", sourceId: payment.id,
        description: `Reversal of payment ${payment.id}: ${reason}`,
        currencyCode: payment.invoice.currencyCode,
        lines: isSale
          ? [{ accountCode: "1100", debit: payment.amount }, { accountCode: "1000", credit: payment.amount }]
          : [{ accountCode: "1000", debit: payment.amount }, { accountCode: "2000", credit: payment.amount }],
      });
      return reversed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return handlePrismaError(error, "Payment"); }
};
