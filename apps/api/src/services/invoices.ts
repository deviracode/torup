import { createServiceClient } from "../lib/supabase.js";

/**
 * Invoice generation and storage.
 * Invoices are stored as structured JSON data in the database.
 * A PDF generation service can be added later.
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id?: string;
  business_id: string;
  invoice_number: string;
  issued_at: string;
  due_at: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  customer_name: string;
  customer_email: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  payplus_transaction_id: string | null;
}

/**
 * Generate an invoice number (YYYYMM-NNNN format).
 */
async function generateInvoiceNumber(businessId: string): Promise<string> {
  const supabase = createServiceClient();
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Count existing invoices this month for sequence
  const { count } = await supabase
    .from("notifications_log")
    .select("id", { count: "exact" })
    .eq("business_id", businessId)
    .eq("type", "invoice")
    .gte("sent_at", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);

  const seq = String((count || 0) + 1).padStart(4, "0");
  return `INV-${prefix}-${seq}`;
}

/**
 * Create an invoice for a subscription payment.
 */
export async function createSubscriptionInvoice(params: {
  business_id: string;
  plan_name: string;
  amount: number;
  customer_name: string;
  customer_email: string;
  payplus_transaction_id?: string;
}): Promise<Invoice> {
  const invoiceNumber = await generateInvoiceNumber(params.business_id);

  const now = new Date();
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const taxRate = 0.17; // Israel VAT
  const subtotal = params.amount;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  const invoice: Invoice = {
    business_id: params.business_id,
    invoice_number: invoiceNumber,
    issued_at: now.toISOString(),
    due_at: dueDate.toISOString(),
    status: params.payplus_transaction_id ? "paid" : "sent",
    customer_name: params.customer_name,
    customer_email: params.customer_email,
    items: [
      {
        description: `${params.plan_name} - Monthly Subscription`,
        quantity: 1,
        unit_price: subtotal,
        total: subtotal,
      },
    ],
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    currency: "ILS",
    notes: null,
    payplus_transaction_id: params.payplus_transaction_id || null,
  };

  // Store invoice data in notifications_log as structured JSON
  // In production, use a dedicated invoices table
  const supabase = createServiceClient();
  await supabase.from("notifications_log").insert({
    business_id: params.business_id,
    type: "invoice",
    channel: "system",
    template_id: invoiceNumber,
    status: invoice.status,
    customer_id: null,
    sent_at: now.toISOString(),
    error: JSON.stringify(invoice),
  });

  return invoice;
}

/**
 * Get invoices for a business.
 */
export async function getBusinessInvoices(
  businessId: string
): Promise<Invoice[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("notifications_log")
    .select("*")
    .eq("business_id", businessId)
    .eq("type", "invoice")
    .order("sent_at", { ascending: false });

  if (!data) return [];

  return data.map((row: { error?: string | null }) => {
    try {
      return JSON.parse(row.error || "{}") as Invoice;
    } catch {
      return null;
    }
  }).filter(Boolean) as Invoice[];
}

/**
 * Generate invoice HTML (for display or PDF conversion).
 */
export function renderInvoiceHtml(invoice: Invoice): string {
  const itemRows = invoice.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₪${item.unit_price.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₪${item.total.toFixed(2)}</td>
        </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html dir="ltr">
<head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px">
  <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:40px">
    <div>
      <h1 style="margin:0;color:#1a56db">TorUp</h1>
      <p style="color:#666;margin:4px 0">Invoice</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-weight:bold">${invoice.invoice_number}</p>
      <p style="color:#666;margin:4px 0">Issued: ${new Date(invoice.issued_at).toLocaleDateString()}</p>
      <p style="color:#666;margin:4px 0">Due: ${new Date(invoice.due_at).toLocaleDateString()}</p>
      <span style="background:${invoice.status === "paid" ? "#dcfce7" : "#fef3c7"};color:${invoice.status === "paid" ? "#166534" : "#92400e"};padding:2px 8px;border-radius:12px;font-size:12px">${invoice.status.toUpperCase()}</span>
    </div>
  </div>

  <div style="margin-bottom:30px">
    <p style="color:#666;margin:0">Bill to:</p>
    <p style="margin:4px 0;font-weight:bold">${invoice.customer_name}</p>
    <p style="margin:4px 0;color:#666">${invoice.customer_email}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Description</th>
        <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0">Qty</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #e2e8f0">Price</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #e2e8f0">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="text-align:right;margin-top:20px">
    <p style="margin:4px 0">Subtotal: ₪${invoice.subtotal.toFixed(2)}</p>
    <p style="margin:4px 0;color:#666">VAT (${(invoice.tax_rate * 100).toFixed(0)}%): ₪${invoice.tax_amount.toFixed(2)}</p>
    <p style="margin:8px 0;font-size:20px;font-weight:bold">Total: ₪${invoice.total.toFixed(2)}</p>
  </div>
</body>
</html>`;
}
