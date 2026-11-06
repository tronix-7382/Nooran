import { OrganizationRole, Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { AppError } from "../../utils/appError.js";
import { defaultAccounts } from "../accounting/ledger.service.js";
import { paginatedResult, type Pagination } from "../shared/module.helpers.js";

export interface OrganizationInput {
  name?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

const toPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError("An organization with this tax ID already exists", 409);
    }
    if (error.code === "P2025") {
      throw new AppError("Organization not found", 404);
    }
    if (error.code === "P2003" || error.code === "P2014" || error.code === "P2034") {
      throw new AppError("Organization has dependent records or changed concurrently", 409);
    }
  }
  throw error;
};

export const createOrganization = async (
  userId: string,
  input: Required<Pick<OrganizationInput, "name" | "phone">> & OrganizationInput,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          phone: input.phone,
          ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
        },
      });
      await tx.account.createMany({
        data: defaultAccounts.map((account) => ({ ...account, organizationId: organization.id, isSystem: true })),
      });

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
          isActive: true,
        },
      });

      return organization;
    });
  } catch (error) {
    return toPrismaError(error);
  }
};

export const listOrganizations = async (userId: string, pagination: Pagination) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, isActive: true },
    orderBy: { joinedAt: "asc" },
    include: { organization: true },
    skip: pagination.skip,
    take: pagination.take,
  });
  const total = await prisma.organizationMember.count({ where: { userId, isActive: true } });
  const items = memberships.map(({ organization, role, joinedAt }) => ({
    ...organization,
    membership: { role, joinedAt },
  }));
  return paginatedResult(items, total, pagination);
};

const requireMembership = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  });

  if (!membership?.isActive) {
    throw new AppError("Organization not found", 404);
  }

  return membership;
};

export const getOrganization = async (userId: string, organizationId: string) => {
  const membership = await requireMembership(userId, organizationId);
  return {
    ...membership.organization,
    membership: { role: membership.role, joinedAt: membership.joinedAt },
  };
};

export const updateOrganization = async (
  userId: string,
  organizationId: string,
  input: OrganizationInput,
) => {
  const membership = await requireMembership(userId, organizationId);
  if (membership.role !== OrganizationRole.OWNER) {
    throw new AppError("Only an organization owner can update it", 403);
  }

  try {
    return await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...input,
        // An empty string explicitly clears nullable fields.
        ...(input.taxId === "" ? { taxId: null } : {}),
        ...(input.address === "" ? { address: null } : {}),
      },
    });
  } catch (error) {
    return toPrismaError(error);
  }
};

export const deleteOrganization = async (userId: string, organizationId: string) => {
  const membership = await requireMembership(userId, organizationId);
  if (membership.role !== OrganizationRole.OWNER) {
    throw new AppError("Only an organization owner can delete it", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const invoiceCount = await tx.invoice.count({ where: { organizationId } });
      if (invoiceCount > 0) {
        throw new AppError("An organization with invoices cannot be deleted", 409);
      }
      await tx.organization.delete({ where: { id: organizationId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return toPrismaError(error);
  }
};
