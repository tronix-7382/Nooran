import { z } from "zod";
export const addMemberSchema = z.object({ email: z.email(), role: z.literal("ACCOUNTANT").optional() }).strict();
export const updateMemberSchema = z.object({
  role: z.literal("ACCOUNTANT").optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." });
export const transferOwnershipSchema = z.object({ memberId: z.string().uuid() }).strict();
