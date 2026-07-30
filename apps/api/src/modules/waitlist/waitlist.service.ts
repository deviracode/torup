import { AppError } from "../../middleware/error-handler";
import { type createWaitlistRepo } from "./waitlist.repository";

type Repo = ReturnType<typeof createWaitlistRepo>;

export function createWaitlistService(repo: Repo) {
  return {
    async list(businessId: string) {
      const { data, error } = await repo.findAll(businessId);
      if (error) throw new AppError(500, error.message);
      return data;
    },
    async join(data: {
      business_id: string; service_id: string; customer_id: string;
      requested_date: string; requested_time: string;
    }) {
      const { data: entry, error } = await repo.create({ ...data, status: "waiting" });
      if (error) throw new AppError(400, error.message);
      return entry;
    },
  };
}
