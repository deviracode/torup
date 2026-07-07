"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function MockPaymentPage() {
  const params = useSearchParams();
  const successUrl = params.get("success_url") || "/";
  const failureUrl = params.get("failure_url") || "/";
  const description = params.get("description") || "Subscription";
  const amount = params.get("amount") || "0";
  const businessId = params.get("business_id") || "";
  const planId = params.get("plan_id") || "";
  const billing = params.get("billing") || "monthly";
  const apiUrl = params.get("api_url") || "http://localhost:3001";
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`${apiUrl}/api/billing/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_code: "000",
          transaction: { uid: "mock-txn-" + Date.now() },
          more_info: JSON.stringify({ business_id: businessId, plan_id: planId, billing }),
        }),
      });
    } catch {}
    window.location.href = successUrl;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "hsl(242 44% 8%)" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Mock badge */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 mb-4">
            🧪 MOCK PAYMENT — Development Only
          </span>
          <h1 className="text-xl font-bold text-white">Payment Checkout</h1>
          <p className="text-white/50 text-sm mt-1">{description}</p>
        </div>

        {/* Order summary */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-white/60">
            <span>Amount</span>
            <span className="text-white font-semibold">₪{Number(amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Status</span>
            <span className="text-green-400">Ready to charge</span>
          </div>
        </div>

        {/* Mock card form (visual only) */}
        <div className="space-y-3">
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
            placeholder="4111 1111 1111 1111 (test card)"
            defaultValue="4111 1111 1111 1111"
            readOnly
          />
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
              placeholder="MM/YY"
              defaultValue="12/30"
              readOnly
            />
            <input
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
              placeholder="CVV"
              defaultValue="123"
              readOnly
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="block w-full text-center py-3 rounded-xl font-bold text-white text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            {approving ? "Processing..." : "✓ Approve Payment (simulate success)"}
          </button>
          <a
            href={failureUrl}
            className="block w-full text-center py-3 rounded-xl font-medium text-white/60 text-sm border border-white/10 hover:border-white/20"
          >
            ✗ Decline Payment (simulate failure)
          </a>
        </div>

        <p className="text-center text-xs text-white/20">
          This page only appears in development when PAYPLUS_MOCK=true
        </p>
      </div>
    </div>
  );
}
