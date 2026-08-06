"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Zap } from "lucide-react";
import { formatILS } from "@/lib/format";

const MONTHLY_PRICE = 149;

export default function BillingPage() {
  const tNav = useTranslations("nav");
  const t = useTranslations("billing");
  const features = t.raw("features") as string[];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">{tNav("billing")}</h1>

      <div className="space-y-4">
        {/* Current Plan */}
        <div className="rounded-xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">{t("currentPlan")}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-white">Professional</p>
              <p className="text-sm text-white/40 mt-1">{formatILS(MONTHLY_PRICE)} / {t("perMonth")}</p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold bg-[hsl(38_62%_58%)]/15 border border-[hsl(38_62%_58%)]/40 text-[hsl(38_70%_68%)]">
              {t("active")}
            </span>
          </div>
        </div>

        {/* Plan Features */}
        <div className="rounded-xl border border-white/8 p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">{t("planFeatures")}</p>
          <ul className="space-y-3">
            {features.map((feature) => (
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
            <Zap className="h-4 w-4 text-[#818cf8]" />
            <p className="font-semibold text-white">{t("needMore")}</p>
          </div>
          <p className="text-sm text-white/50 mb-4">
            {t("upgradeDesc")}
          </p>
          <button
            onClick={() => toast.info(t("upgradeComingSoon"))}
            className="rounded-[10px] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
            style={{ background: "var(--grad-primary)" }}
          >
            {t("upgradePlan")}
          </button>
        </div>
      </div>
    </div>
  );
}
