"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, animate] = useAnimate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signIn(email, password);
      const isSuperAdmin = user?.user_metadata?.role === "super_admin";
      router.push(`/${locale}/${isSuperAdmin ? "admin" : "dashboard"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      animate(scope.current, { x: [0, 10, -10, 6, -6, 0] }, { duration: 0.4 });
    } finally {
      setLoading(false);
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
