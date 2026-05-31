import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth.js";
import { getBusinessId } from "../lib/params.js";
import { createServiceClient } from "../lib/supabase.js";
import { getAuthUrl, exchangeCode, listCalendars, syncGoogleCalendar } from "../services/google-calendar.js";
import { AppError } from "../middleware/error-handler.js";

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

// GET /businesses/:businessId/google-calendar/auth-url
router.get(
  "/auth-url",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  (req: AuthenticatedRequest, res: Response) => {
    const businessId = getBusinessId(req);
    const url = getAuthUrl(businessId);
    res.json({ url });
  }
);

// POST /businesses/:businessId/google-calendar/connect
router.post(
  "/connect",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const { code } = req.body;
      if (!code) throw new AppError(400, "Authorization code required");

      const tokens = await exchangeCode(code);
      const supabase = createServiceClient();

      await supabase.from("google_calendar_tokens").upsert({
        business_id: businessId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at.toISOString(),
      }, { onConflict: "business_id" });

      res.json({ connected: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/google-calendar/connect
router.delete(
  "/connect",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const supabase = createServiceClient();
      await supabase.from("google_calendar_tokens").delete().eq("business_id", businessId);
      await supabase.from("google_calendar_events").delete().eq("business_id", businessId);
      res.json({ disconnected: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/google-calendar/status
router.get(
  "/status",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("google_calendar_id, sync_enabled, push_enabled, token_expires_at, updated_at")
        .eq("business_id", businessId)
        .single();

      res.json({
        connected: !!data,
        calendarId: data?.google_calendar_id || null,
        syncEnabled: data?.sync_enabled ?? false,
        pushEnabled: data?.push_enabled ?? false,
        tokenExpiresAt: data?.token_expires_at || null,
        lastSyncAt: data?.updated_at || null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/google-calendar/settings
router.patch(
  "/settings",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const supabase = createServiceClient();
      const { google_calendar_id, sync_enabled, push_enabled } = req.body;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (google_calendar_id !== undefined) update.google_calendar_id = google_calendar_id;
      if (sync_enabled !== undefined) update.sync_enabled = sync_enabled;
      if (push_enabled !== undefined) update.push_enabled = push_enabled;

      await supabase.from("google_calendar_tokens").update(update).eq("business_id", businessId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/google-calendar/sync — trigger immediate sync
router.post(
  "/sync",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const result = await syncGoogleCalendar(businessId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/google-calendar/calendars
router.get(
  "/calendars",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const calendars = await listCalendars(businessId);
      res.json({ calendars });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
