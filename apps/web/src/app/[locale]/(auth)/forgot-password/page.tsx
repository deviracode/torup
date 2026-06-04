"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function ForgotPasswordPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--grad-success)" }}>
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isRtl ? "נשלח!" : "Check your email"}
        </h2>
        <p className="text-sm text-white/40 mb-6">{t("resetLinkSent" as any)}</p>
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin" as any)}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "איפוס סיסמה" : "Reset password"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "נשלח לך קישור לאיפוס" : "We'll send you a reset link"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60" htmlFor="email">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("sendResetLink" as any)}
        </motion.button>
      </form>

      <p className="mt-5 text-center">
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin" as any)}
        </Link>
      </p>
    </div>
  );
}
