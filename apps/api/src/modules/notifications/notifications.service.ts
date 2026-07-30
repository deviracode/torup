import { AppError } from "../../middleware/error-handler";
import { type createNotificationRepo } from "./notifications.repository";

type Repo = ReturnType<typeof createNotificationRepo>;

export function createNotificationService(repo: Repo) {
  return {
    async list(
      businessId: string,
      opts?: { limit?: number; offset?: number; type?: string; appointmentId?: string },
    ) {
      const { data, error } = await repo.findLog(businessId, opts);
      if (error) throw new AppError(500, error.message);
      return data;
    },
  };
}
