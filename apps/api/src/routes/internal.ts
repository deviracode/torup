import { Router, type Request, type Response, type NextFunction } from "express";
import { processReminders, sendManagerNotification } from "../services/notifications.js";
import { syncGoogleCalendar } from "../services/google-calendar.js";

const router: ReturnType<typeof Router> = Router();

function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_SECRET;
  const provided = req.header("x-internal-secret");
  if (!expected || provided !== expected) {
    res.sendStatus(401);
    return;
  }
  next();
}

router.post("/reminders/tick", requireInternalSecret, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await processReminders();
    console.log(
      `[internal/reminders/tick] processed=${counts.processed} sent=${counts.sent} failed=${counts.failed}`
    );
    res.json(counts);
  } catch (err) {
    next(err);
  }
});

router.post("/notify-manager", requireInternalSecret, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) { res.status(400).json({ error: "appointmentId required" }); return; }
    await sendManagerNotification(appointmentId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/google-calendar/sync", requireInternalSecret, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = (await import("../lib/supabase.js")).createServiceClient();
    const { data: tokens } = await supabase
      .from("google_calendar_tokens")
      .select("business_id")
      .eq("sync_enabled", true);

    const businesses = tokens?.map((t) => t.business_id) || [];
    let totalImported = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    for (const businessId of businesses) {
      const result = await syncGoogleCalendar(businessId);
      totalImported += result.imported;
      totalDeleted += result.deleted;
      if (result.error) errors.push(`${businessId}: ${result.error}`);
    }

    console.log(
      `[internal/google-calendar/sync] businesses=${businesses.length} imported=${totalImported} deleted=${totalDeleted} errors=${errors.length}`
    );
    res.json({ businesses: businesses.length, imported: totalImported, deleted: totalDeleted, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    next(err);
  }
});

export default router;
