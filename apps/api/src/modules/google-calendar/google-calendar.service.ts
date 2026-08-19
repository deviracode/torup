import { exchangeCode } from "../../services/google-calendar";
import { type createGcalRepo } from "./google-calendar.repository";

type Repo = ReturnType<typeof createGcalRepo>;

export function createGcalService(repo: Repo) {
  return {
    async connect(businessId: string, code: string) {
      const tokens = await exchangeCode(code);
      await repo.upsertToken({
        business_id: businessId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at.toISOString(),
      });
      return { connected: true };
    },
    async disconnect(businessId: string) {
      await repo.deleteTokens(businessId);
      await repo.deleteEvents(businessId);
      return { disconnected: true };
    },
    async status(businessId: string) {
      const { data } = await repo.findTokenStatus(businessId);
      return {
        connected: !!data,
        calendarId: data?.google_calendar_id || null,
        syncEnabled: data?.sync_enabled ?? false,
        pushEnabled: data?.push_enabled ?? false,
        tokenExpiresAt: data?.token_expires_at || null,
        lastSyncAt: data?.updated_at || null,
      };
    },
    async updateSettings(
      businessId: string,
      input: { google_calendar_id?: string; sync_enabled?: boolean; push_enabled?: boolean }
    ) {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.google_calendar_id !== undefined)
        update.google_calendar_id = input.google_calendar_id;
      if (input.sync_enabled !== undefined) update.sync_enabled = input.sync_enabled;
      if (input.push_enabled !== undefined) update.push_enabled = input.push_enabled;
      await repo.updateTokenSettings(businessId, update);
      return { ok: true };
    },
    async events(businessId: string, date: string) {
      const { data } = await repo.findEvents(businessId, date);
      return data || [];
    },
  };
}
