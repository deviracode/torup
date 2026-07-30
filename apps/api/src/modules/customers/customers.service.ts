import { AppError } from "../../middleware/error-handler";
import { type createCustomerRepo } from "./customers.repository";

type Repo = ReturnType<typeof createCustomerRepo>;

export function createCustomerService(repo: Repo) {
  return {
    async list(businessId: string, search?: string) {
      const { data: ids } = await repo.findCustomerIdsForBusiness(businessId);
      const unique = [...new Set((ids || []).map((c: Record<string, any>) => c.customer_id as string))];
      if (unique.length === 0) return [];
      const { data, error } = await repo.findByIds(unique, search);
      if (error) throw new AppError(500, error.message);
      return data;
    },
    async findOrCreate(input: { phone: string; name?: string; language_preference?: string }) {
      const existing = (await repo.findByPhone(input.phone)).data;
      if (existing) return existing;
      const { data, error } = await repo.create({ phone: input.phone, name: input.name || null, language_preference: input.language_preference || "he" });
      if (error) throw new AppError(400, error.message);
      return data;
    },
    async edit(customerId: string, data: Record<string, unknown>) {
      const { data: c, error } = await repo.update(customerId, data);
      if (error) throw new AppError(400, error.message);
      return c;
    },
  };
}
