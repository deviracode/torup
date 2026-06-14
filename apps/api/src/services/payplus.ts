/**
 * PayPlus Israeli Payment Gateway Integration
 * API docs: https://www.payplus.co.il/developers
 */

const PAYPLUS_API_URL = process.env.PAYPLUS_API_URL || "https://restapidev.payplus.co.il/api/v1.0";

function getHeaders(): Record<string, string> {
  const apiKey = process.env.PAYPLUS_API_KEY || "";
  const secretKey = process.env.PAYPLUS_SECRET_KEY || "";
  const token = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${token}`,
  };
}

async function payPlusRequest<T>(
  endpoint: string,
  method: string = "POST",
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${PAYPLUS_API_URL}${endpoint}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPlus API error (${res.status}): ${errText}`);
  }

  return res.json() as Promise<T>;
}

interface PaymentPageResponse {
  data: {
    page_request_uid: string;
    payment_page_link: string;
  };
  results: { status: string };
}

/**
 * Generate a PayPlus payment page for subscription.
 */
export async function generatePaymentPage(params: {
  amount: number;
  currency?: string;
  description: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  business_id: string;
  plan_id: string;
  billing?: "monthly" | "annual";
  recurring?: boolean;
  successUrl?: string;
  failureUrl?: string;
}): Promise<{ paymentPageUrl: string; pageRequestUid: string }> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const apiUrl = process.env.API_URL || "http://localhost:3001";
  const response = await payPlusRequest<PaymentPageResponse>(
    "/PaymentPages/generateLink",
    "POST",
    {
      payment_page_uid: process.env.PAYPLUS_PAGE_UID || "",
      amount: params.amount,
      currency_code: params.currency || "ILS",
      charge_method: params.recurring ? 2 : 1, // 2 = recurring
      description: params.description,
      customer: {
        customer_name: params.customer_name,
        email: params.customer_email,
        phone: params.customer_phone || "",
      },
      more_info: JSON.stringify({
        business_id: params.business_id,
        plan_id: params.plan_id,
        billing: params.billing || "monthly",
      }),
      sendEmailApproval: true,
      refURL_success: params.successUrl || `${appUrl}/dashboard/billing?status=success`,
      refURL_failure: params.failureUrl || `${appUrl}/dashboard/billing?status=failed`,
      refURL_callback: `${apiUrl}/api/billing/webhook`,
    }
  );

  return {
    paymentPageUrl: response.data.payment_page_link,
    pageRequestUid: response.data.page_request_uid,
  };
}

interface ChargeResponse {
  data: {
    transaction_uid: string;
    status: string;
    status_code: string;
  };
  results: { status: string };
}

/**
 * Charge a recurring subscription.
 */
export async function chargeRecurring(params: {
  token: string;
  amount: number;
  description: string;
}): Promise<ChargeResponse> {
  return payPlusRequest<ChargeResponse>("/Transactions/ChargeByToken", "POST", {
    terminal_uid: process.env.PAYPLUS_TERMINAL_UID || "",
    token: params.token,
    amount: params.amount,
    currency_code: "ILS",
    more_info: params.description,
  });
}

/**
 * Cancel a recurring subscription/token.
 */
export async function cancelSubscriptionPayment(token: string): Promise<void> {
  await payPlusRequest("/Token/Cancel", "POST", {
    terminal_uid: process.env.PAYPLUS_TERMINAL_UID || "",
    token,
  });
}
