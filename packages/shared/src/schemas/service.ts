import { z } from "zod";

export const serviceSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name_he: z.string().min(1).max(200),
  name_ar: z.string().max(200).nullable(),
  name_en: z.string().max(200).nullable(),
  description_he: z.string().max(1000).nullable(),
  description_ar: z.string().max(1000).nullable(),
  description_en: z.string().max(1000).nullable(),
  duration_minutes: z.number().int().min(5).max(480),
  buffer_minutes: z.number().int().min(0).max(120).default(0),
  price: z.number().min(0),
  max_capacity: z.number().int().min(1).max(100).default(1),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  color: z.string().nullable().optional(),
});

export const createServiceSchema = serviceSchema.omit({
  id: true,
  business_id: true,
});

export const updateServiceSchema = createServiceSchema.partial();

export type Service = z.infer<typeof serviceSchema>;
export type CreateService = z.infer<typeof createServiceSchema>;
export type UpdateService = z.infer<typeof updateServiceSchema>;
