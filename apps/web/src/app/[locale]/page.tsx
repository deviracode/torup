"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import { staggerContainer, fadeUpItem } from "@/components/motion";
import { Calendar, MessageCircle, BarChart3, Globe } from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    titleHe: "ניהול תורים חכם",
    titleEn: "Smart Scheduling",
    descHe: "לוח זמנים אוטומטי, ניהול זמינות וחלונות זמן",
    descEn: "Automated calendar, availability management and time slots",
  },
  {
    icon: MessageCircle,
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
    titleHe: "בוט WhatsApp",
    titleEn: "WhatsApp Bot",
    descHe: "קביעת תורים אוטומטית דרך WhatsApp עם בינה מלאכותית",
    descEn: "AI-powered appointment booking via WhatsApp",
  },
  {
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    titleHe: "אנליטיקס",
    titleEn: "Analytics",
    descHe: "מעקב ביצועים, הכנסות ודוחות מפורטים",
    descEn: "Track performance, revenue and detailed reports",
  },
  {
    icon: Globe,
    gradient: "linear-gradient(135deg, #f472b6, #a78bfa)",
    titleHe: "רב-שפתי",
    titleEn: "Multilingual",
    descHe: "תמיכה בעברית, ערבית ואנגלית עם RTL מלא",
    descEn: "Hebrew, Arabic and English with full RTL support",
  },
];

export default function HomePage() {
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";

  return (
    <main className="min-h-screen" style={{ background: "hsl(244 93% 5%)" }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="orb-1 absolute w-[600px] h-[600px] rounded-full top-[-200px] left-[-150px]"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="orb-2 absolute w-[500px] h-[500px] rounded-full top-[-100px] right-[-100px]"
          style={{
            background: "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="orb-3 absolute w-[400px] h-[400px] rounded-full bottom-[-150px] left-1/2"
          style={{
            background: "radial-gradient(circle, rgba(244,114,182,0.2) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/6"
        style={{ background: "rgba(6,6,18,0.8)", backdropFilter: "blur(16px)" }}
      >
        <span
          className="text-xl font-black tracking-tight"
          style={{
            background: "var(--grad-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TorUp
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/login`}
            className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5"
          >
            {isRtl ? "כניסה" : "Login"}
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Link
              href={`/${locale}/register`}
              className="text-sm font-bold text-white rounded-[10px] px-4 py-2"
              style={{ background: "var(--grad-primary)" }}
            >
              {isRtl ? "התחל בחינם" : "Get Started"}
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 border"
          style={{
            background: "rgba(99,102,241,0.12)",
            borderColor: "rgba(99,102,241,0.3)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#a78bfa]" />
          <span className="text-xs font-semibold text-[#a78bfa]">
            {isRtl ? "פלטפורמת ניהול תורים חכמה" : "AI-Powered Scheduling Platform"}
          </span>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number], delay: 0.2 }}
          className="text-5xl sm:text-6xl font-black tracking-tight max-w-2xl mb-5"
          style={{
            background: "linear-gradient(135deg, #e0e7ff 0%, #a78bfa 50%, #f472b6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.1,
          }}
        >
          {isRtl ? "קביעת תורים חכמה, ללא מאמץ" : "Smart Booking, Zero Friction"}
        </motion.h1>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="text-lg text-white/50 max-w-md mb-8"
        >
          {isRtl
            ? "בוט WhatsApp + לוח מחוונים יפה לעסקים מודרניים"
            : "WhatsApp bot + beautiful dashboard for modern businesses"}
        </motion.p>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-10"
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 rounded-[12px] px-7 py-3 text-base font-bold text-white"
              style={{ background: "var(--grad-primary)", boxShadow: "0 8px 30px rgba(99,102,241,0.4)" }}
            >
              {isRtl ? "התחל בחינם ←" : "Start Free →"}
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 rounded-[12px] px-7 py-3 text-base font-semibold text-white/70 border border-white/12 hover:border-white/25 hover:text-white transition-colors"
            >
              {isRtl ? "כניסה" : "Sign In"}
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-5 sm:grid-cols-2"
        >
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.titleEn}
                variants={fadeUpItem}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-2xl p-6 border border-white/6 cursor-default"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-4"
                  style={{ background: f.gradient }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {isRtl ? f.titleHe : f.titleEn}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {isRtl ? f.descHe : f.descEn}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/6 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-white/30">
          <Link href={`/${locale}/terms`} className="hover:text-white/70 transition-colors">
            {isRtl ? "תנאי שימוש" : "Terms"}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-white/70 transition-colors">
            {isRtl ? "מדיניות פרטיות" : "Privacy"}
          </Link>
          <Link href={`/${locale}/data-deletion`} className="hover:text-white/70 transition-colors">
            {isRtl ? "מחיקת מידע" : "Data Deletion"}
          </Link>
          <span>&copy; {new Date().getFullYear()} TorUp</span>
        </div>
      </footer>
    </main>
  );
}
