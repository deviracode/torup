import { Router, type Router as RouterType } from "express";
import { createServiceClient } from "../lib/supabase.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { generatePaymentPage } from "../services/payplus.js";
import {
  activateSubscription,
  cancelSubscription,
  changePlan,
  extendTrial,
} from "../services/subscription.js";
import {
  getBusinessInvoices,
  renderInvoiceHtml,
} from "../services/invoices.js";

const router: RouterType = Router();

// POST /billing/subscribe — Create a subscription (generate payment page)
router.post(
  "/subscribe",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { business_id, plan_id, billing = "monthly", success_url, failure_url } = req.body;

      const supabase = createServiceClient();

      const { data: plan } = await supabase
        .from("plans")
        .select("name, monthly_price, yearly_price")
        .eq("id", plan_id)
        .single();

      if (!plan) throw new AppError(404, "Plan not found");

      const { data: business } = await supabase
        .from("businesses")
        .select("name, email")
        .eq("id", business_id)
        .single();

      if (!business) throw new AppError(404, "Business not found");

      let amount: number;
      if (billing === "annual") {
        amount = plan.yearly_price != null
          ? plan.yearly_price * 12
          : Math.round(plan.monthly_price * 0.9 * 12);
      } else {
        amount = plan.monthly_price;
      }

      const result = await generatePaymentPage({
        amount,
        description: `${plan.name} - ${business.name} (${billing})`,
        customer_name: business.name,
        customer_email: business.email || req.userEmail || "",
        business_id,
        plan_id,
        billing,
        recurring: true,
        successUrl: success_url,
        failureUrl: failure_url,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /billing/webhook — PayPlus webhook callback
router.post("/webhook", async (req, res, next) => {
  try {
    const { transaction, more_info, status_code } = req.body;

    // Parse business context from more_info
    let context: { business_id?: string; plan_id?: string; billing?: string } = {};
    try {
      context = JSON.parse(more_info || "{}");
    } catch {}

    if (!context.business_id) {
      res.status(200).json({ received: true });
      return;
    }

    if (status_code === "000") {
      // Successful payment
      await activateSubscription(
        context.business_id,
        context.plan_id || "",
        transaction?.uid,
        context.billing === "annual" ? "annual" : "monthly"
      );
    } else {
      // Failed payment — mark as past_due handled by subscription service
      console.log(`Payment failed for business ${context.business_id}: ${status_code}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

// POST /billing/cancel — Cancel subscription
router.post(
  "/cancel",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { business_id } = req.body;
      await cancelSubscription(business_id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /billing/change-plan — Upgrade/downgrade
router.post(
  "/change-plan",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { business_id, plan_id } = req.body;
      await changePlan(business_id, plan_id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /billing/extend-trial — Admin: extend trial
router.post(
  "/extend-trial",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { business_id, days } = req.body;
      await extendTrial(business_id, Number(days) || 14);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /billing/status — Get subscription status
router.get(
  "/status",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const businessId = req.query.business_id as string;
      if (!businessId) throw new AppError(400, "business_id required");

      const supabase = createServiceClient();
      const { data } = await supabase
        .from("subscriptions")
        .select("*, plans(name, monthly_price, yearly_price, max_staff, max_appointments_monthly, features)")
        .eq("business_id", businessId)
        .single();

      res.json({ subscription: data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /billing/invoices — List invoices for a business
router.get(
  "/invoices",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const businessId = req.query.business_id as string;
      if (!businessId) throw new AppError(400, "business_id required");

      const invoices = await getBusinessInvoices(businessId);
      res.json({ invoices });
    } catch (err) {
      next(err);
    }
  }
);

// GET /billing/invoices/:invoiceNumber/html — Render invoice as HTML
router.get(
  "/invoices/:invoiceNumber/html",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const businessId = req.query.business_id as string;
      if (!businessId) throw new AppError(400, "business_id required");

      const invoices = await getBusinessInvoices(businessId);
      const invoice = invoices.find(
        (inv) => inv.invoice_number === req.params.invoiceNumber
      );

      if (!invoice) throw new AppError(404, "Invoice not found");

      const html = renderInvoiceHtml(invoice);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
