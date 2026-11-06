import { z } from "zod";
const partyFields = {
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  address: z.string().trim().optional(),
  type: z.enum(["CUSTOMER", "SUPPLIER"]).optional(),
};
export const createPartySchema = z.object(partyFields).strict().required({ name: true, phone: true });
export const updatePartySchema = z.object(partyFields).strict().partial()
  .refine((input) => Object.keys(input).length > 0, { message: "At least one field is required." });
