import { AppError } from "../../middleware/error-handler";
import { type createBusinessRepo } from "./businesses.repository";

type Repo = ReturnType<typeof createBusinessRepo>;

export function createBusinessService(repo: Repo) {
  return {
    async getCurrent(businessId: string) {
      const { data, error } = await repo.findById(businessId);
      if (error || !data) throw new AppError(404, "Business not found");
      return data;
    },
    async getBySlugOrId(slugOrId: string) {
      const { data, error } = await repo.findBySlugOrId(slugOrId);
      if (error || !data) throw new AppError(404, "Business not found");
      return data;
    },
    async edit(businessId: string, data: Record<string, unknown>) {
      const { data: business, error } = await repo.update(businessId, data);
      if (error) throw new AppError(400, error.message);
      return business;
    },
  };
}
