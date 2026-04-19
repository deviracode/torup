import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../constants.js";

export const customerSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().min(9).max(20),
  name: z.string().min(1).max(200),
  language_preference: z.enum(SUPPORTED_LANGUAGES).default("he"),
  created_at: z.string().datetime(),
});

export const createCustomerSchema = customerSchema.omit({
  id: true,
  created_at: true,
});

export type Customer = z.infer<typeof customerSchema>;
export type CreateCustomer = z.infer<typeof createCustomerSchema>;
