import { Router, type Router as RouterType } from "express";
import { createServiceClient } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { createBillingRepo } from "../modules/billing/billing.repository";
import { createBillingService, cancelSubscription, changePlan, extendTrial } from "../modules/billing/billing.service";

const router: RouterType = Router();

function svc() { return createBillingService(createBillingRepo(createServiceClient())); }

router.post("/subscribe", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { res.json(await svc().subscribe(req.body.business_id, req.body.plan_id, req.userEmail ?? "")); } catch (e) { next(e); } });
router.post("/webhook", async (req, res, next) => { try { res.json(await svc().handleWebhook(req.body)); } catch (e) { next(e); } });
router.post("/cancel", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { await cancelSubscription(req.body.business_id); res.json({ success: true }); } catch (e) { next(e); } });
router.post("/change-plan", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { await changePlan(req.body.business_id, req.body.plan_id); res.json({ success: true }); } catch (e) { next(e); } });
router.post("/extend-trial", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { await extendTrial(req.body.business_id, Number(req.body.days) || 14); res.json({ success: true }); } catch (e) { next(e); } });
router.get("/status", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { res.json(await svc().status(req.query.business_id as string)); } catch (e) { next(e); } });
router.get("/invoices", requireAuth, async (req: AuthenticatedRequest, res, next) => { try { res.json(await svc().invoices(req.query.business_id as string)); } catch (e) { next(e); } });
router.get("/invoices/:invoiceNumber/html", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try { const html = await svc().invoiceHtml(req.query.business_id as string, req.params.invoiceNumber as string); res.setHeader("Content-Type", "text/html"); res.send(html); } catch (e) { next(e); }
});

export default router;
