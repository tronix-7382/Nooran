import { OrganizationRole, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { paginatedResult, requireOrganizationMember, type Pagination } from "../shared/module.helpers.js";

const requireOwner = (userId: string, organizationId: string) => requireOrganizationMember(userId, organizationId, true);
const userSelect = { id: true, email: true, firstName: true, lastName: true, systemRole: true, isActive: true } as const;

export const listMembers = async (userId: string, organizationId: string, pagination: Pagination) => {
  await requireOrganizationMember(userId, organizationId);
  const where = { organizationId };
  const [members, total] = await Promise.all([
    prisma.organizationMember.findMany({
      where,
      orderBy: { joinedAt: "asc" },
      include: { user: { select: userSelect } },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.organizationMember.count({ where }),
  ]);
  return paginatedResult(members, total, pagination);
};

export const addMember = async (userId: string, organizationId: string, email: string) => {
  await requireOwner(userId, organizationId);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  if (!user || !user.isActive) throw new AppError("An active user with this email was not found", 404);
  const current = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId } } });
  if (current?.isActive) throw new AppError("User is already an active organization member", 409);
  if (current?.role === OrganizationRole.OWNER) throw new AppError("An inactive owner must be transferred or reactivated by an administrator", 409);
  return prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    create: { userId: user.id, organizationId, role: OrganizationRole.ACCOUNTANT, isActive: true },
    update: { role: OrganizationRole.ACCOUNTANT, isActive: true },
    include: { user: { select: userSelect } },
  });
};

export const updateMember = async (actorId: string, organizationId: string, memberId: string, input: { role?: "ACCOUNTANT"; isActive?: boolean }) => {
  await requireOwner(actorId, organizationId);
  return prisma.$transaction(async (tx) => {
    const actor = await tx.organizationMember.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId } } });
    if (!actor?.isActive || actor.role !== OrganizationRole.OWNER) throw new AppError("Only an active owner can manage members", 403);
    const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId } });
    if (!target) throw new AppError("Organization member not found", 404);
    if (target.role === OrganizationRole.OWNER && (input.role === OrganizationRole.ACCOUNTANT || input.isActive === false)) {
      const activeOwners = await tx.organizationMember.count({ where: { organizationId, role: OrganizationRole.OWNER, isActive: true } });
      if (activeOwners <= 1) throw new AppError("Transfer ownership before deactivating or demoting the last owner", 409);
    }
    return tx.organizationMember.update({
      where: { id: memberId },
      data: { ...(input.role !== undefined ? { role: input.role } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
      include: { user: { select: userSelect } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

export const deactivateMember = async (actorId: string, organizationId: string, memberId: string) => {
  return updateMember(actorId, organizationId, memberId, { isActive: false });
};

export const transferOwnership = async (actorId: string, organizationId: string, memberId: string) => {
  await requireOwner(actorId, organizationId);
  const target = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId, isActive: true } });
  if (!target) throw new AppError("Active target member was not found", 404);
  if (target.userId === actorId) throw new AppError("The selected member already owns the organization", 400);

  return prisma.$transaction(async (tx) => {
    const currentOwner = await tx.organizationMember.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId } } });
    if (!currentOwner?.isActive || currentOwner.role !== OrganizationRole.OWNER) throw new AppError("Only an active owner can transfer ownership", 403);
    const nextOwner = await tx.organizationMember.update({ where: { id: memberId }, data: { role: OrganizationRole.OWNER } });
    await tx.organizationMember.update({ where: { id: currentOwner.id }, data: { role: OrganizationRole.ACCOUNTANT } });
    return nextOwner;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};
