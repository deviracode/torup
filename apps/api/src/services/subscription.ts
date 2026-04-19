import { createServiceClient } from "../lib/supabase.js";

/**
 * Subscription lifecycle management.
 * States: trial → active → past_due → cancelled → expired
 */

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired";

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trial: ["active", "expired"],
  active: ["past_due", "cancelled"],
  past_due: ["active", "cancelled", "expired"],
  cancelled: [],
  expired: ["active"], // reactivation
};

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Activate subscription after successful payment.
 */
export async function activateSubscription(
  businessId: string,
  planId: string,
  payplusSubscriptionId?: string
): Promise<void> {
  const supabase = createServiceClient();

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      plan_id: planId,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      payplus_subscription_id: payplusSubscriptionId || null,
    })
    .eq("business_id", businessId);
}

/**
 * Mark subscription as past_due after failed payment.
 */
export async function markPastDue(businessId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("business_id", businessId)
    .eq("status", "active");
}

/**
 * Cancel a subscription.
 */
export async function cancelSubscription(businessId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .in("status", ["active", "past_due", "trial"]);
}

/**
 * Check and expire trials that have ended.
 */
export async function processTrialExpirations(): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "trial")
    .lt("trial_ends_at", now);
}

/**
 * Change plan (upgrade/downgrade).
 */
export async function changePlan(
  businessId: string,
  newPlanId: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("subscriptions")
    .update({ plan_id: newPlanId })
    .eq("business_id", businessId)
    .in("status", ["active", "trial"]);
}

/**
 * Extend trial period.
 */
export async function extendTrial(
  businessId: string,
  additionalDays: number
): Promise<void> {
  const supabase = createServiceClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("trial_ends_at")
    .eq("business_id", businessId)
    .eq("status", "trial")
    .single();

  if (!sub) return;

  const currentEnd = new Date(sub.trial_ends_at);
  const newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  await supabase
    .from("subscriptions")
    .update({ trial_ends_at: newEnd.toISOString() })
    .eq("business_id", businessId)
    .eq("status", "trial");
}

/**
 * Check plan enforcement (feature limits).
 */
export async function checkPlanLimits(
  businessId: string
): Promise<{ withinLimits: boolean; reason?: string }> {
  const supabase = createServiceClient();

  // Get subscription and plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plans(max_staff, max_appointments_monthly)")
    .eq("business_id", businessId)
    .in("status", ["active", "trial"])
    .single();

  if (!sub) return { withinLimits: false, reason: "No active subscription" };

  const plan = (sub as unknown as { plans: { max_staff: number; max_appointments_monthly: number } }).plans;

  // Check staff count
  const { count: staffCount } = await supabase
    .from("business_members")
    .select("id", { count: "exact" })
    .eq("business_id", businessId);

  if (staffCount && staffCount > plan.max_staff) {
    return { withinLimits: false, reason: `Staff limit exceeded (${staffCount}/${plan.max_staff})` };
  }

  // Check monthly appointment count
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: aptCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact" })
    .eq("business_id", businessId)
    .gte("created_at", monthStart.toISOString())
    .not("status", "eq", "cancelled");

  if (aptCount && aptCount > plan.max_appointments_monthly) {
    return { withinLimits: false, reason: `Monthly appointment limit exceeded (${aptCount}/${plan.max_appointments_monthly})` };
  }

  return { withinLimits: true };
}
