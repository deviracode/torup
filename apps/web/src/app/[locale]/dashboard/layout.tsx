"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBarProvider, useTopBar } from "@/components/dashboard/top-bar-context";
import { AnimatePresence, motion } from "framer-motion";
import { pageVariants } from "@/components/motion";
import { useAuth } from "@/components/auth/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session) return;
    const token = session.access_token;

    async function check() {
      try {
        const bizRes = await fetch(`${API_URL}/api/businesses/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!bizRes.ok) {
          router.replace(`/${locale}/onboarding`);
          return;
        }
        const biz = await bizRes.json();
        if (!biz?.id) {
          router.replace(`/${locale}/onboarding`);
          return;
        }

        const subRes = await fetch(`${API_URL}/api/billing/status?business_id=${biz.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!subRes.ok) {
          router.replace(`/${locale}/onboarding`);
          return;
        }
        const { subscription } = await subRes.json();
        if (!subscription || subscription.status !== "active") {
          router.replace(`/${locale}/onboarding`);
          return;
        }

        setChecked(true);
      } catch {
        // Fail open on network error
        setChecked(true);
      }
    }

    check();
  }, [session, locale, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

const PAGE_TITLES: Record<string, { he: string; en: string }> = {
  "/dashboard":            { he: "לוח שנה",    en: "Calendar"  },
  "/dashboard/customers":  { he: "לקוחות",     en: "Customers" },
  "/dashboard/services":   { he: "שירותים",    en: "Services"  },
  "/dashboard/analytics":  { he: "אנליטיקס",   en: "Analytics" },
  "/dashboard/billing":    { he: "חיוב",       en: "Billing"   },
  "/dashboard/settings":   { he: "הגדרות",     en: "Settings"  },
};

function TopBar() {
  const { actions } = useTopBar();
  const pathname = usePathname();
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const { session } = useAuth();

  const rawPath =
    Object.keys(PAGE_TITLES)
      .sort((a, b) => b.length - a.length)
      .find((p) => pathname.includes(p)) ?? "/dashboard";
  const title = isRtl
    ? PAGE_TITLES[rawPath]?.he ?? "Dashboard"
    : PAGE_TITLES[rawPath]?.en ?? "Dashboard";

  const initials = session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="h-11 hidden md:flex items-center gap-3 px-5 border-b border-white/6 flex-shrink-0" style={{ background: "hsl(242 44% 10% / 50%)" }}>
      <span className="text-sm font-semibold text-white/90">{title}</span>
      <div className="flex-1" />
      {actions}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: "var(--grad-warm)" }}
        aria-label="User avatar"
      >
        {initials}
      </div>
    </header>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col md:flex-row md:h-screen md:overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 md:overflow-hidden">
        <TopBar />
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 md:overflow-auto p-4 md:p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SubscriptionGuard>
          <TopBarProvider>
            <DashboardShell>{children}</DashboardShell>
          </TopBarProvider>
        </SubscriptionGuard>
      </AuthGuard>
    </AuthProvider>
  );
}
