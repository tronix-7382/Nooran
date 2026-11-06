import { AccountType, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { requireOrganizationMember } from "../shared/module.helpers.js";

export const defaultAccounts = [
  { code: "1000", name: "Cash and bank", type: AccountType.ASSET },
  { code: "1100", name: "Accounts receivable", type: AccountType.ASSET },
  { code: "1200", name: "Inventory", type: AccountType.ASSET },
  { code: "2000", name: "Accounts payable", type: AccountType.LIABILITY },
  { code: "2100", name: "Sales tax payable", type: AccountType.LIABILITY },
  { code: "3000", name: "Retained earnings", type: AccountType.EQUITY },
  { code: "4000", name: "Sales revenue", type: AccountType.REVENUE },
  { code: "4010", name: "Sales discounts", type: AccountType.REVENUE },
  { code: "4100", name: "Other revenue", type: AccountType.REVENUE },
  { code: "5000", name: "Cost of goods sold", type: AccountType.EXPENSE },
] as const;

type Tx = Prisma.TransactionClient;
type JournalLineInput = { accountCode: string; debit?: Prisma.Decimal | number; credit?: Prisma.Decimal | number };

export const ensureDefaultAccounts = async (tx: Tx, organizationId: string) => {
  await tx.account.createMany({
    data: defaultAccounts.map((account) => ({ ...account, organizationId, isSystem: true })),
    skipDuplicates: true,
  });
};

export const postJournalEntry = async (tx: Tx, input: {
  organizationId: string; createdByUserId: string; sourceType: string; sourceId: string;
  description: string; currencyCode: string; lines: JournalLineInput[];
}) => {
  const lines = input.lines
    .map((line) => ({
      accountCode: line.accountCode,
      debit: new Prisma.Decimal(line.debit ?? 0),
      credit: new Prisma.Decimal(line.credit ?? 0),
    }))
    .filter((line) => !line.debit.eq(0) || !line.credit.eq(0));
  if (lines.length < 2) throw new AppError("A journal entry requires at least two non-zero lines", 500);
  if (lines.some((line) => line.debit.lt(0) || line.credit.lt(0) || (line.debit.gt(0) && line.credit.gt(0)))) {
    throw new AppError("Journal lines must have one non-negative debit or credit value", 400);
  }
  const debits = lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
  const credits = lines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));
  if (!debits.equals(credits)) throw new AppError("Journal entry is not balanced", 500);

  await ensureDefaultAccounts(tx, input.organizationId);
  const accounts = await tx.account.findMany({ where: { organizationId: input.organizationId, code: { in: lines.map((line) => line.accountCode) } } });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const details = lines.map((line) => {
    const account = byCode.get(line.accountCode);
    if (!account) throw new AppError(`System account ${line.accountCode} is missing`, 500);
    return { organizationId: input.organizationId, accountId: account.id, debit: line.debit, credit: line.credit };
  });

  return tx.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      description: input.description,
      currencyCode: input.currencyCode,
      lines: { create: details },
    },
    include: { lines: { include: { account: true } } },
  });
};

export const listAccounts = async (userId: string, organizationId: string) => {
  await requireOrganizationMember(userId, organizationId);
  await prisma.$transaction((tx) => ensureDefaultAccounts(tx, organizationId));
  return prisma.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
};

export const listJournalEntries = async (userId: string, organizationId: string) => {
  await requireOrganizationMember(userId, organizationId);
  return prisma.journalEntry.findMany({ where: { organizationId }, include: { lines: { include: { account: true } } }, orderBy: { transactionDate: "desc" } });
};

export const getJournalEntry = async (userId: string, organizationId: string, entryId: string) => {
  await requireOrganizationMember(userId, organizationId);
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, organizationId }, include: { lines: { include: { account: true } } } });
  if (!entry) throw new AppError("Journal entry not found", 404);
  return entry;
};

export const getAccountLedger = async (userId: string, organizationId: string, accountId: string) => {
  await requireOrganizationMember(userId, organizationId);
  const account = await prisma.account.findFirst({ where: { id: accountId, organizationId } });
  if (!account) throw new AppError("Account not found", 404);
  const lines = await prisma.journalLine.findMany({ where: { accountId, organizationId }, include: { entry: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const debit = lines.reduce((sum, line) => sum.add(line.debit), new Prisma.Decimal(0));
  const credit = lines.reduce((sum, line) => sum.add(line.credit), new Prisma.Decimal(0));
  const normalDebit = account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;
  return { account, lines, debit, credit, balance: normalDebit ? debit.sub(credit) : credit.sub(debit) };
};
