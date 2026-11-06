import { z } from "zod";
const fields = {
  name: z.string().trim().min(1),
  sku: z.union([z.string().trim().min(1), z.literal("")]).optional(),
  unit: z.string().trim().min(1),
  salePriceDefault: z.coerce.number().finite().nonnegative(),
};
export const createProductSchema = z.object(fields).strict();
export const updateProductSchema = z.object(fields).strict().partial()
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required." });
