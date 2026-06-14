"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { cn, Button, Badge } from "@torup/ui";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const BUSINESS_CATEGORIES = [
  { value: "barber", label_he: "מספרה", label_en: "Barber", label_ar: "حلاق" },
  { value: "hair_salon", label_he: "סלון שיער", label_en: "Hair Salon", label_ar: "صالون شعر" },
  { value: "beauty_salon", label_he: "סלון יופי", label_en: "Beauty Salon", label_ar: "صالون تجميل" },
  { value: "nail_salon", label_he: "סלון ציפורניים", label_en: "Nail Salon", label_ar: "صالون أظافر" },
  { value: "spa", label_he: "ספא", label_en: "Spa", label_ar: "سبا" },
  { value: "gym", label_he: "חדר כושר", label_en: "Gym", label_ar: "صالة رياضية" },
  { value: "clinic", label_he: "קליניקה", label_en: "Clinic", label_ar: "عيادة" },
  { value: "dental", label_he: "מרפאת שיניים", label_en: "Dental", label_ar: "عيادة أسنان" },
  { value: "physiotherapy", label_he: "פיזיותרפיה", label_en: "Physiotherapy", label_ar: "علاج طبيعي" },
  { value: "tattoo", label_he: "קעקועים", label_en: "Tattoo", label_ar: "وشم" },
  { value: "yoga_studio", label_he: "סטודיו יוגה", label_en: "Yoga Studio", label_ar: "استوديو يوغا" },
  { value: "pet_grooming", label_he: "טיפוח חיות מחמד", label_en: "Pet Grooming", label_ar: "تجميل حيوانات" },
  { value: "auto_service", label_he: "מוסך / שירות רכב", label_en: "Auto Service", label_ar: "خدمة سيارات" },
  { value: "consulting", label_he: "ייעוץ", label_en: "Consulting", label_ar: "استشارات" },
  { value: "tutoring", label_he: "שיעורים פרטיים", label_en: "Tutoring", label_ar: "دروس خصوصية" },
  { value: "photography", label_he: "צילום", label_en: "Photography", label_ar: "تصوير" },
  { value: "other", label_he: "אחר", label_en: "Other", label_ar: "أخرى" },
];

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price?: number | null;
  staff_limit: number | null;
  features?: {
    whatsapp_bot?: boolean;
    ai_bot?: boolean;
  };
  is_ai?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const { session } = useAuth();
  const isRtl = locale === "he" || locale === "ar";

  const [step, setStep] = useState(1);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Step 1 state
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Step 3 state
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 2 && plans.length === 0) {
      setPlansLoading(true);
      fetch(`${API_URL}/api/plans`)
        .then((res) => res.json())
        .then((data) => {
          setPlans(Array.isArray(data) ? data : data.plans ?? []);
        })
        .catch(() => {})
        .finally(() => setPlansLoading(false));
    }
  }, [step, plans.length]);

  function getCategoryLabel(cat: typeof BUSINESS_CATEGORIES[0]) {
    if (locale === "he") return cat.label_he;
    if (locale === "ar") return cat.label_ar;
    return cat.label_en;
  }

  async function handleStep1Submit() {
    if (!businessName.trim() || !category || !phone.trim()) return;
    setStep1Loading(true);
    setStep1Error(null);
    try {
      const res = await fetch(`${API_URL}/api/onboarding/business`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          name: businessName.trim(),
          category,
          phone: phone.trim(),
          address: address.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        // User already has a business — fetch it and continue
        const meRes = await fetch(`${API_URL}/api/businesses/me`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });
        if (meRes.ok) {
          const biz = await meRes.json();
          setBusinessId(biz.id);
          setStep(2);
          return;
        }
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "Error");
      }
      const data = await res.json();
      setBusinessId(data.business_id ?? data.id ?? null);
      setStep(2);
    } catch (err: unknown) {
      setStep1Error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStep1Loading(false);
    }
  }

  async function handlePayNow() {
    if (!selectedPlanId || !businessId) return;
    setPayLoading(true);
    setPayError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = `${origin}/${locale}/onboarding/callback`;
    try {
      const res = await fetch(`${API_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_id: selectedPlanId,
          billing,
          success_url: `${base}?status=success`,
          failure_url: `${base}?status=failed`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "Payment failed");
      }
      const data = await res.json();
      const paymentUrl = data.payment_url ?? data.url ?? data.redirect_url;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayLoading(false);
    }
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  function getPlanPrice(plan: Plan): number {
    if (billing === "annual") {
      return plan.yearly_price != null ? plan.yearly_price : plan.monthly_price * 0.9;
    }
    return plan.monthly_price;
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">{t("title")}</h1>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              s <= step ? "bg-indigo-500" : "bg-white/10"
            )}
          />
        ))}
      </div>

      {/* Step 1 — Business Details */}
      {step === 1 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">{t("step1")}</h2>

          <div className="space-y-1">
            <label className="text-sm text-white/60">{t("businessName")}</label>
            <input
              className={inputClass}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("businessName")}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-white/60">{t("category")}</label>
            <select
              className={cn(inputClass, "appearance-none cursor-pointer")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="" disabled className="bg-[#1a1640] text-white/40">
                {t("selectCategory")}
              </option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-[#1a1640] text-white">
                  {getCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-white/60">{t("phone")}</label>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phone")}
              type="tel"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-white/60">{t("address")}</label>
            <input
              className={inputClass}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("address")}
            />
          </div>

          {step1Error && (
            <p className="text-sm text-red-400">{step1Error}</p>
          )}

          <Button
            onClick={handleStep1Submit}
            disabled={!businessName.trim() || !category || !phone.trim() || step1Loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {step1Loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("next")
            )}
          </Button>
        </div>
      )}

      {/* Step 2 — Choose a Plan */}
      {step === 2 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">{t("step2")}</h2>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                billing === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "text-white/50 hover:text-white"
              )}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
                billing === "annual"
                  ? "bg-indigo-600 text-white"
                  : "text-white/50 hover:text-white"
              )}
            >
              {t("annual")}
              <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                {t("savePercent")}
              </span>
            </button>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((plan) => {
                const price = getPlanPrice(plan);
                const isSelected = selectedPlanId === plan.id;
                const isAi = plan.is_ai || plan.name.toLowerCase().includes("ai");
                const hasWhatsapp = plan.features?.whatsapp_bot ?? false;
                const hasAi = plan.features?.ai_bot ?? false;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      "relative text-start p-4 rounded-xl border transition-all",
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    )}
                  >
                    {isAi && (
                      <Badge className="absolute top-3 end-3 bg-indigo-600 text-white text-xs">
                        {t("mostPopular")}
                      </Badge>
                    )}
                    <p className="font-semibold text-white text-sm mb-1">{plan.name}</p>
                    <p className="text-2xl font-bold text-white mb-0.5">
                      ${price.toFixed(0)}
                      <span className="text-sm font-normal text-white/50">/{t("perMonth")}</span>
                    </p>
                    {billing === "annual" && (
                      <p className="text-xs text-white/40 mb-2">{t("billedAnnually")}</p>
                    )}
                    <ul className="mt-3 space-y-1 text-xs text-white/60">
                      <li className="flex items-center gap-1.5">
                        {plan.staff_limit == null ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        )}
                        {plan.staff_limit == null
                          ? t("unlimitedStaff")
                          : `${t("staffUpTo")} ${plan.staff_limit}`}
                      </li>
                      <li className="flex items-center gap-1.5">
                        {hasWhatsapp ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-white/20 shrink-0" />
                        )}
                        WhatsApp Bot
                      </li>
                      <li className="flex items-center gap-1.5">
                        {hasAi ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-white/20 shrink-0" />
                        )}
                        AI Bot
                      </li>
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
            >
              {t("back")}
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedPlanId}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Payment */}
      {step === 3 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">{t("step3")}</h2>

          {/* Order Summary */}
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-white/70">{t("orderSummary")}</p>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">{t("plan")}</span>
              <span className="text-white font-medium">{selectedPlan?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">{t("billing")}</span>
              <span className="text-white font-medium">
                {billing === "monthly" ? t("monthly") : t("annual")}
              </span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between">
              <span className="text-white/50 text-sm">{t("amount")}</span>
              <span className="text-white font-bold text-lg">
                ${selectedPlan ? getPlanPrice(selectedPlan).toFixed(0) : "0"}
                <span className="text-sm font-normal text-white/50">/{t("perMonth")}</span>
              </span>
            </div>
          </div>

          {payError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{payError}</span>
              <button
                onClick={() => setPayError(null)}
                className="ms-auto text-red-400/60 hover:text-red-400 text-xs"
              >
                {t("tryAgain")}
              </button>
            </div>
          )}

          {payLoading && (
            <p className="text-sm text-white/50 text-center">{t("redirectingToPayment")}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={payLoading}
              className="flex-1 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
            >
              {t("back")}
            </Button>
            <Button
              onClick={handlePayNow}
              disabled={payLoading || !selectedPlanId || !businessId}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {payLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("payNow")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
