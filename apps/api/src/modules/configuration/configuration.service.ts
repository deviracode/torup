import { AppError } from "../../middleware/error-handler";
import { cacheGet, cacheSet, cacheClear } from "../../lib/redis";
import { type createConfigRepo } from "./configuration.repository";

type Repo = ReturnType<typeof createConfigRepo>;

export function createConfigService(repo: Repo) {
  return {
    async getWorkingHours(businessId: string) {
      const key = `wh:${businessId}`;
      const cached = await cacheGet(key); if (cached) return JSON.parse(cached);
      const { data, error } = await repo.findWorkingHours(businessId); if (error) throw new AppError(500, error.message);
      await cacheSet(key, JSON.stringify(data), 300); return data;
    },
    async setWorkingHours(businessId: string, body: Record<string, unknown>[]) {
      await repo.deleteWorkingHours(businessId);
      const { data, error } = await repo.insertWorkingHours(body.map(r => ({ ...r, business_id: businessId })));
      if (error) throw new AppError(400, error.message); await cacheClear(`wh:${businessId}`); return data;
    },
    async getBreaks(businessId: string) { const { data, error } = await repo.findBreaks(businessId); if (error) throw new AppError(500, error.message); return data; },
    async addBreak(businessId: string, body: Record<string, unknown>) { const { data, error } = await repo.createBreak({ ...body, business_id: businessId }); if (error) throw new AppError(400, error.message); return data; },
    async removeBreak(breakId: string, businessId: string) { const { error } = await repo.deleteBreak(breakId, businessId); if (error) throw new AppError(400, error.message); },
    async getBookingRules(businessId: string) { const { data, error } = await repo.findBookingRules(businessId); if (error) throw new AppError(404, "Booking rules not found"); return data; },
    async setBookingRules(businessId: string, body: Record<string, unknown>) { const { data, error } = await repo.upsertBookingRules({ ...body, business_id: businessId }); if (error) throw new AppError(400, error.message); return data; },
    async getReminderSettings(businessId: string) { const { data, error } = await repo.findReminderSettings(businessId); if (error) throw new AppError(500, error.message); return data; },
    async addReminderSetting(businessId: string, minutesBefore: number) {
      if (!minutesBefore || typeof minutesBefore !== "number" || minutesBefore <= 0) throw new AppError(400, "minutes_before must be a positive integer");
      const { data, error } = await repo.createReminderSetting({ business_id: businessId, minutes_before: minutesBefore });
      if (error) { if (error.code === "23505") throw new AppError(409, "Reminder interval already exists"); throw new AppError(400, error.message); }
      return data;
    },
    async editReminderSetting(reminderId: string, businessId: string, isActive: boolean) { const { data, error } = await repo.updateReminderSetting(reminderId, businessId, { is_active: isActive }); if (error) throw new AppError(400, error.message); return data; },
    async removeReminderSetting(reminderId: string, businessId: string) { const { error } = await repo.deleteReminderSetting(reminderId, businessId); if (error) throw new AppError(400, error.message); },
  };
}
