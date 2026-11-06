import { z } from "zod";

const optionalText = z.string().trim().min(1).optional();

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(1, "Organization name is required."),
    taxId: optionalText,
    phone: z.string().trim().min(1, "Phone number is required."),
    address: z.string().trim().min(1).optional(),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    taxId: z.union([z.string().trim().min(1), z.literal("")]).optional(),
    phone: z.string().trim().min(1).optional(),
    address: z.union([z.string().trim().min(1), z.literal("")]).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one organization field must be provided.",
  });

export const organizationIdSchema = z.string().uuid("Invalid organization ID.");
