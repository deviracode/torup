import { createServiceClient } from "./supabase.js";

export interface PlanLimits {
  planId: string;
  planName: string;
  maxStaff: number | null;
  maxAppointmentsMonthly: number | null;
  hasWhatsappBot: boolean;
  hasAiBot: boolean;
  maxAiTokensMonthly: number;
}

/**
 * Returns plan limits for the business's active subscription.
 * Returns null if no active subscription exists.
 */
export async function getPlanLimits(businessId: string): Promise<PlanLimits | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("subscriptions")
    .select(`
      plan_id,
      plans (
        id,
        name,
        max_staff,
        max_appointments_monthly,
        has_whatsapp_bot,
        has_ai_bot,
        max_ai_tokens_monthly
      )
    `)
    .eq("business_id", businessId)
    .eq("status", "active")
    .single();

  if (!data?.plans) return null;

  const plan = data.plans as unknown as Record<string, unknown>;

  return {
    planId: plan.id as string,
    planName: plan.name as string,
    maxStaff: plan.max_staff as number | null,
    maxAppointmentsMonthly: plan.max_appointments_monthly as number | null,
    hasWhatsappBot: plan.has_whatsapp_bot as boolean,
    hasAiBot: plan.has_ai_bot as boolean,
    maxAiTokensMonthly: plan.max_ai_tokens_monthly as number,
  };
}

/**
 * Increment AI token usage for the current month.
 * Non-fatal — call fire-and-forget after a successful bot response.
 */
export async function incrementAiTokenUsage(
  businessId: string,
  tokensUsed: number
): Promise<void> {
  const supabase = createServiceClient();
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const monthStr = month.toISOString().split("T")[0];

  await supabase.rpc("increment_ai_tokens", {
    p_business_id: businessId,
    p_month: monthStr,
    p_tokens: tokensUsed,
  });
}
