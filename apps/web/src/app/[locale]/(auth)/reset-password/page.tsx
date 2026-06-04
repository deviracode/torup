"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function ResetPasswordPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const establish = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setError(error.message);
      } else if (window.location.hash.includes("access_token")) {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
      setReady(true);
    };
    establish();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setUpdated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (updated) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--grad-success)" }}>
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isRtl ? "הסיסמה עודכנה" : "Password updated"}
        </h2>
        <p className="text-sm text-white/40 mb-6">{t("passwordUpdated" as any)}</p>
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin" as any)}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "סיסמה חדשה" : "New password"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "בחר סיסמה חדשה לחשבונך" : "Choose a new password for your account"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {!ready && (
          <div className="text-sm text-white/40 text-center py-2">
            {isRtl ? "מאמת קישור..." : "Verifying link..."}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60" htmlFor="password">
            {t("newPassword" as any)}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading || !ready}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("resetPassword")}
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
