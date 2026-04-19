import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../constants.js";

export const businessSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  logo_url: z.string().url().nullable(),
  cover_url: z.string().url().nullable(),
  category: z.string().min(1).max(100),
  phone: z.string().min(9).max(20),
  email: z.string().email(),
  address: z.string().max(500).nullable(),
  social_links: z.record(z.string()).nullable(),
  default_language: z.enum(SUPPORTED_LANGUAGES),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createBusinessSchema = businessSchema.omit({
  id: true,
  slug: true,
  is_active: true,
  created_at: true,
  updated_at: true,
});

export const updateBusinessSchema = createBusinessSchema.partial();

export type Business = z.infer<typeof businessSchema>;
export type CreateBusiness = z.infer<typeof createBusinessSchema>;
export type UpdateBusiness = z.infer<typeof updateBusinessSchema>;
