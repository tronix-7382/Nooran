import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";

export const listParties = async (userId: string, organizationId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const [items, total] = await Promise.all([
    prisma.party.findMany({ where: { organizationId }, orderBy: { name: "asc" }, skip: pagination.skip, take: pagination.take }),
    prisma.party.count({ where: { organizationId } }),
  ]);
  return paginatedResult(items, total, pagination);
};
export const getParty = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const party = await prisma.party.findFirst({ where: { id, organizationId } });
  if (!party) throw new AppError("Party not found", 404);
  return party;
};
export const createParty = async (userId: string, organizationId: string, input: Record<string, unknown>) => {
  await requireOrganizationMember(userId, organizationId);
  try { return await prisma.party.create({ data: { ...input, organizationId } as never }); }
  catch (error) { return handlePrismaError(error, "Party"); }
};
export const updateParty = async (userId: string, organizationId: string, id: string, input: Record<string, unknown>) => {
  await requireOrganizationMember(userId, organizationId);
  const current = await prisma.party.findFirst({ where: { id, organizationId } });
  if (!current) throw new AppError("Party not found", 404);
  if (input.type && input.type !== current.type && await prisma.invoice.count({ where: { partyId: id } })) {
    throw new AppError("Party type cannot change after invoices have been created", 409);
  }
  try { return await prisma.party.update({ where: { id }, data: input as never }); }
  catch (error) { return handlePrismaError(error, "Party"); }
};
export const deleteParty = async (userId: string, organizationId: string, id: string) => {
  await requireOrganizationMember(userId, organizationId);
  const current = await prisma.party.findFirst({ where: { id, organizationId } });
  if (!current) throw new AppError("Party not found", 404);
  if (await prisma.invoice.count({ where: { partyId: id } })) throw new AppError("Party is used by invoices and cannot be deleted", 409);
  await prisma.party.delete({ where: { id } });
};
