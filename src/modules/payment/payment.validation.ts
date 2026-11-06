import { z } from "zod";
export const createPaymentSchema = z.object({
  amount: z.coerce.number().finite().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
  reference: z.string().trim().min(1).optional(),
}).strict();
export const reversePaymentSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
