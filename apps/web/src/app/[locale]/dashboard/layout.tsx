"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { BusinessProvider, useBusiness } from "@/components/auth/business-provider";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBarProvider, useTopBar } from "@/components/dashboard/top-bar-context";
import { motion } from "framer-motion";
import { pageVariants } from "@/components/motion";

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

function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useBusiness();
  const { session } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin");

  if (!impersonating) return null;

  const handleExit = async () => {
    try {
      await apiFetch(
        "/api/admin/stop-impersonate",
        { method: "POST", body: JSON.stringify({ business_id: impersonating.id }) },
        session?.access_token
      );
    } catch {
      // Audit-log call is best-effort; still exit locally.
    }
    stopImpersonation();
    router.push(`/${locale}/admin`);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2 bg-orange-500/90 text-white text-sm font-medium flex-shrink-0">
      <span>
        {t("impersonating")} <strong>{impersonating.name}</strong>
      </span>
      <button
        onClick={handleExit}
        className="rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold"
      >
        {t("stopImpersonating")}
      </button>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col md:h-screen md:overflow-hidden">
      <ImpersonationBanner />
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 md:overflow-hidden">
          <TopBar />
          {/* Enter-only page transition. AnimatePresence mode="wait" + key={pathname}
              was gating on the exit animation before mounting the next route, which
              in the App Router (layout children swap without remounting the layout)
              left the panel blank after navigation. Keying motion.main on pathname
              still replays the enter animation per route without blocking mount. */}
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            className="flex-1 md:overflow-auto p-4 md:p-6"
          >
            {children}
          </motion.main>
        </div>
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
        <BusinessProvider>
          <TopBarProvider>
            <DashboardShell>{children}</DashboardShell>
          </TopBarProvider>
        </BusinessProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
