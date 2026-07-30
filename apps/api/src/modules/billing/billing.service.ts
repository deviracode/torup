import { AppError } from "../../middleware/error-handler";
import { generatePaymentPage } from "../../services/payplus";
import { activateSubscription, cancelSubscription, changePlan, extendTrial } from "../../services/subscription";
import { getBusinessInvoices, renderInvoiceHtml } from "../../services/invoices";
import { type createBillingRepo } from "./billing.repository";

type Repo = ReturnType<typeof createBillingRepo>;

export function createBillingService(repo: Repo) {
  return {
    async subscribe(businessId: string, planId: string, userEmail: string) {
      const plan = (await repo.findPlan(planId)).data; if (!plan) throw new AppError(404, "Plan not found");
      const biz = (await repo.findBusiness(businessId)).data; if (!biz) throw new AppError(404, "Business not found");
      return generatePaymentPage({ amount: plan.monthly_price, description: `${plan.name} - ${biz.name}`, customer_name: biz.name, customer_email: biz.email || userEmail || "", business_id: businessId, plan_id: planId, recurring: true });
    },
    async handleWebhook(body: { transaction?: { uid: string }; more_info?: string; status_code?: string }) {
      let ctx: { business_id?: string; plan_id?: string } = {}; try { ctx = JSON.parse(body.more_info || "{}"); } catch {}
      if (!ctx.business_id) return { received: true };
      if (body.status_code === "000") await activateSubscription(ctx.business_id, ctx.plan_id || "", body.transaction?.uid);
      else console.log(`Payment failed: ${ctx.business_id}: ${body.status_code}`);
      return { received: true };
    },
    async status(businessId: string) { return { subscription: (await repo.findSubscription(businessId)).data }; },
    async invoices(businessId: string) { return { invoices: await getBusinessInvoices(businessId) }; },
    async invoiceHtml(businessId: string, invNo: string) {
      const invoices = await getBusinessInvoices(businessId);
      const inv = invoices.find((i: any) => i.invoice_number === invNo);
      if (!inv) throw new AppError(404, "Invoice not found");
      return renderInvoiceHtml(inv);
    },
  };
}

export { cancelSubscription, changePlan, extendTrial };
