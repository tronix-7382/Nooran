import { z } from "zod";
const fields = {
  productId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  purchasePrice: z.coerce.number().finite().nonnegative(),
  initialQuantity: z.coerce.number().finite().positive(),
  remainingQuantity: z.coerce.number().finite().nonnegative().optional(),
  expireDate: z.union([z.iso.datetime().transform((value) => new Date(value)), z.null()]).optional(),
};
export const createBatchSchema = z.object(fields).strict();
export const updateBatchSchema = z.object({
  purchasePrice: z.coerce.number().finite().nonnegative().optional(),
  initialQuantity: z.coerce.number().finite().positive().optional(),
  remainingQuantity: z.coerce.number().finite().nonnegative().optional(),
  expireDate: z.union([z.iso.datetime().transform((value) => new Date(value)), z.null()]).optional(),
}).strict().refine((input) => Object.keys(input).length > 0, { message: "At least one field is required." });
