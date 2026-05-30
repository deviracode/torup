import { Router, type Request, type Response, type NextFunction } from "express";
import { processReminders } from "../services/notifications.js";

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

export default router;
