"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { translateAuthError } from "@/lib/auth-errors";
import { motion, useAnimate } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function LoginPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, animate] = useAnimate();
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (searchParams.get("error") === "email_confirmation_failed") {
      setShowResend(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signIn(email, password);
      const isSuperAdmin = user?.user_metadata?.role === "super_admin";
      router.push(`/${locale}/${isSuperAdmin ? "admin" : "dashboard"}`);
    } catch (err) {
      setError(translateAuthError(err as Error, t));
      animate(scope.current, { x: [0, 10, -10, 6, -6, 0] }, { duration: 0.4 });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendError("");
    setResendSuccess(false);
    setResendLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to resend");
      }
      setResendSuccess(true);
    } catch (err) {
      setResendError(translateAuthError(err as Error, t));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm" ref={scope}>
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "ברוך הבא" : "Welcome back"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "היכנס לחשבון TorUp שלך" : "Sign in to your TorUp account"}
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

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <div className={`flex ${isRtl ? "justify-start" : "justify-end"}`}>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-xs text-[#a78bfa] hover:text-white transition-colors"
            >
              {t("forgotPassword" as any)}
            </Link>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowResend(!showResend)}
            className="text-xs text-white/40 hover:text-[#a78bfa] transition-colors"
          >
            {isRtl ? "לא קיבלת אימייל אימות? שלח שוב" : "Didn't receive confirmation? Resend it"}
          </button>
        </div>

        {showResend && (
          <div className="space-y-2 rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-white/60">
              {isRtl ? "הזן את האימייל שלך לשליחת אימייל האימות מחדש" : "Enter your email to resend the confirmation"}
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="name@example.com"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                disabled={resendLoading}
                onClick={handleResend}
                className="rounded-[10px] bg-[#6366f1]/20 border border-[#6366f1]/30 px-3 py-2 text-xs font-medium text-[#a78bfa] hover:bg-[#6366f1]/30 transition-colors disabled:opacity-50"
              >
                {resendLoading ? t("loading") : (isRtl ? "שלח" : "Send")}
              </button>
            </div>
            {resendSuccess && (
              <p className="text-xs text-green-400">
                {isRtl ? "נשלח! בדוק את תיבת הדואר שלך" : "Sent! Check your email"}
              </p>
            )}
            {resendError && (
              <p className="text-xs text-red-300">{resendError}</p>
            )}
          </div>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("login")}
        </motion.button>
      </form>

      <p className="mt-5 text-center text-sm text-white/40">
        <Link href={`/${locale}/register`} className="text-[#a78bfa] hover:text-white transition-colors">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
