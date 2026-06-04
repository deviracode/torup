"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";

const FEATURES = [
  { icon: "📅", he: "ניהול תורים אוטומטי",         en: "Automated appointment scheduling" },
  { icon: "💬", he: "בוט WhatsApp עם בינה מלאכותית", en: "AI-powered WhatsApp bot"           },
  { icon: "📊", he: "אנליטיקס בזמן אמת",            en: "Real-time analytics dashboard"     },
];

function BrandPanel() {
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";

  return (
    <motion.div
      initial={{ x: isRtl ? 40 : -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="hidden md:flex w-[45%] flex-col justify-center px-10 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
      }}
    >
      {/* Ambient orb */}
      <div
        className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10">
        <h1
          className="text-4xl font-black tracking-tight mb-3"
          style={{
            background: "var(--grad-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TorUp
        </h1>
        <p className="text-sm text-white/50 leading-relaxed mb-8">
          {isRtl
            ? "הפלטפורמה החכמה לניהול תורים לעסקים מודרניים"
            : "The smart scheduling platform for modern service businesses"}
        </p>

        <ul className="space-y-4">
          {FEATURES.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "var(--grad-primary)" }}
              >
                {f.icon}
              </span>
              <span className="text-sm text-white/70">
                {isRtl ? f.he : f.en}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <BrandPanel />
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
          className="flex flex-1 items-center justify-center p-8"
        >
          {children}
        </motion.div>
      </div>
    </AuthProvider>
  );
}
