"use client";

import { useTranslations } from "next-intl";
import { Check, Zap } from "lucide-react";

export default function BillingPage() {
  const tNav = useTranslations("nav");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">{tNav("billing")}</h1>

      <div className="space-y-4">
        {/* Current Plan */}
        <div className="rounded-xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">Current Plan</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-white">Professional</p>
              <p className="text-sm text-white/40 mt-1">₪149/month</p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
              Active
            </span>
          </div>
        </div>

        {/* Plan Features */}
        <div className="rounded-xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">Plan Features</p>
          <ul className="space-y-3">
            {[
              "Up to 5 staff members",
              "Unlimited appointments",
              "WhatsApp agent",
              "Web booking page",
              "Analytics dashboard",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 flex-shrink-0">
                  <Check className="h-3 w-3 text-emerald-400" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Upgrade CTA */}
        <div
          className="rounded-xl border border-[#6366f1]/30 p-6"
          style={{ background: "rgba(99,102,241,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[#a78bfa]" />
            <p className="font-semibold text-white">Need more?</p>
          </div>
          <p className="text-sm text-white/50 mb-4">
            Upgrade to Business plan for unlimited staff and priority support.
          </p>
          <button
            className="rounded-[10px] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
            style={{ background: "var(--grad-primary)" }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
