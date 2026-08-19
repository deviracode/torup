"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function WelcomePage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === "he" || locale === "ar";

  const whatsappUrl = "https://wa.me/972524433123?text=" + encodeURIComponent(
    "היי, יצרתי חשבון ב-TorUp ואני רוצה להתחבר לעסק שלי"
  );

  return (
    <div className="w-full max-w-sm">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <h2 className="text-2xl font-bold text-white mb-1">
          {isRtl ? "ברוך הבא ל-TorUp" : "Welcome to TorUp"}
        </h2>
        <p className="text-sm text-white/40 mb-6">
          {isRtl
            ? "החשבון שלך נוצר בהצלחה"
            : "Your account has been created successfully"}
        </p>

        <div
          className="rounded-xl border border-white/8 p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            {isRtl
              ? "כדי לחבר את החשבון שלך לעסק קיים או לפתוח עסק חדש, דברו איתנו בוואטסאפ:"
              : "To connect your account to an existing business or set up a new one, contact us on WhatsApp:"}
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-bold text-white hover:brightness-110 transition-all"
            style={{ background: "#25D366" }}
          >
            <MessageCircle className="h-4 w-4" />
            {isRtl ? "דברו איתנו בוואטסאפ" : "Contact us on WhatsApp"}
          </a>
        </div>

        <button
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          {isRtl ? "לדשבורד" : "Go to Dashboard"}
          <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
        </button>
      </motion.div>
    </div>
  );
}
