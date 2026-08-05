import { AppError } from "../../middleware/error-handler";
import { type createCategoryRepo } from "./categories.repository";

type Repo = ReturnType<typeof createCategoryRepo>;

export function createCategoryService(repo: Repo) {
  return {
    async list(businessId: string) {
      const { data, error } = await repo.findAll(businessId);
      if (error) throw new AppError(500, error.message);
      return data;
    },
    async add(
      businessId: string,
      input: {
        name_he: string;
        name_ar?: string | null;
        name_en?: string | null;
        sort_order?: number;
      }
    ) {
      const { name_he, name_ar, name_en, sort_order } = input;
      if (!name_he) throw new AppError(400, "name_he is required");
      const { data, error } = await repo.create({
        name_he,
        name_ar: name_ar || null,
        name_en: name_en || null,
        sort_order: sort_order ?? 0,
        business_id: businessId,
      });
      if (error) throw new AppError(400, error.message);
      return data;
    },
    async edit(categoryId: string, businessId: string, data: Record<string, unknown>) {
      const { error } = await repo.update(categoryId, businessId, data);
      if (error) throw new AppError(400, error.message);
    },
    async remove(categoryId: string, businessId: string) {
      const { error } = await repo.remove(categoryId, businessId);
      if (error) throw new AppError(400, error.message);
    },
  };
}
