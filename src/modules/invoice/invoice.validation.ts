import { z } from "zod";
const fields = {
  partyId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).optional(),
  type: z.enum(["PURCHASE", "SALE"]).optional(),
  discountAmount: z.coerce.number().finite().nonnegative().optional(),
  taxAmount: z.coerce.number().finite().nonnegative().optional(),
  otherCharges: z.coerce.number().finite().nonnegative().optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).optional(),
};
export const createInvoiceSchema = z.object(fields).strict();
export const updateInvoiceSchema = z.object({
  partyId: z.string().uuid().optional(),
  invoiceNumber: z.string().trim().min(1).optional(),
  type: z.enum(["PURCHASE", "SALE"]).optional(),
  status: z.enum(["DRAFT", "FINAL", "CANCELLED"]).optional(),
  discountAmount: z.coerce.number().finite().nonnegative().optional(),
  taxAmount: z.coerce.number().finite().nonnegative().optional(),
  otherCharges: z.coerce.number().finite().nonnegative().optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict().refine((input) => Object.keys(input).length > 0, { message: "At least one field is required." });
