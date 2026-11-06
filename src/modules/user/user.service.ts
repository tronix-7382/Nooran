import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { handlePrismaError, paginatedResult, type Pagination } from "../shared/module.helpers.js";

const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  nationalId: true,
  phone: true,
  phoneVerifiedAt: true,
  systemRole: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listUsers = async (pagination: Pagination) => {
  const [users, total] = await Promise.all([
    prisma.user.findMany({ select: safeUserSelect, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.user.count(),
  ]);
  return paginatedResult(users, total, pagination);
};

export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: safeUserSelect });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

export const updateUser = async (id: string, input: Record<string, unknown>) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { systemRole: true, isActive: true } });
      if (!current) throw new AppError("User not found", 404);
      if (input.isActive === false && current.isActive) {
        const ownerships = await tx.organizationMember.count({ where: { userId: id, role: "OWNER", isActive: true } });
        if (ownerships > 0) throw new AppError("Transfer organization ownership before disabling this user", 409);
      }
      const removesAdminAccess = current.systemRole === "ADMIN" && current.isActive &&
        (input.systemRole !== undefined && input.systemRole !== "ADMIN" || input.isActive === false);
      if (removesAdminAccess) {
        const activeAdmins = await tx.user.count({ where: { systemRole: "ADMIN", isActive: true } });
        if (activeAdmins <= 1) throw new AppError("The last active administrator cannot be demoted or disabled", 409);
      }
      const user = await tx.user.update({
        where: { id },
        data: { ...input, ...(input.nationalId === "" ? { nationalId: null } : {}) },
        select: safeUserSelect,
      });
      if (input.systemRole !== undefined || input.isActive !== undefined) {
        await tx.refreshToken.deleteMany({ where: { userId: id } });
      }
      return user;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    return handlePrismaError(error, "User");
  }
};

export const deleteUser = async (id: string) => {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { systemRole: true, isActive: true } });
      if (!user) throw new AppError("User not found", 404);
      if (user.systemRole === "ADMIN" && user.isActive) {
        const activeAdmins = await tx.user.count({ where: { systemRole: "ADMIN", isActive: true } });
        if (activeAdmins <= 1) throw new AppError("The last active administrator cannot be deleted", 409);
      }
      const ownedOrganizations = await tx.organizationMember.count({ where: { userId: id, role: "OWNER" } });
      if (ownedOrganizations > 0) throw new AppError("User owns organizations and ownership must be transferred before deletion", 409);
      const [issuedInvoices, payments, movements, journalEntries] = await Promise.all([
        tx.invoice.count({ where: { createdByUserId: id } }),
        tx.payment.count({ where: { createdByUserId: id } }),
        tx.stockMovement.count({ where: { createdByUserId: id } }),
        tx.journalEntry.count({ where: { createdByUserId: id } }),
      ]);
      if (issuedInvoices > 0) throw new AppError("User has issued invoices and cannot be deleted", 409);
      if (payments + movements + journalEntries > 0) throw new AppError("User has accounting audit records and cannot be deleted", 409);
      await tx.user.delete({ where: { id } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    return handlePrismaError(error, "User");
  }
};
