import { z } from "zod";
const fields = {
  productId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().nonnegative(),
};
export const createInvoiceItemSchema = z.object(fields).strict();
export const updateInvoiceItemSchema = z.object(fields).strict().partial()
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required." });
