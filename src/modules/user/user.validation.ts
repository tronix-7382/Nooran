import { z } from "zod";

export const updateUserSchema = z.object({
  email: z.email().optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  nationalId: z.union([z.string().trim().min(1), z.literal("")]).optional(),
  systemRole: z.enum(["ADMIN", "HELPER", "USER"]).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});

export const updateOwnUserSchema = z.object({
  email: z.email().optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  nationalId: z.union([z.string().trim().min(1), z.literal("")]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});
