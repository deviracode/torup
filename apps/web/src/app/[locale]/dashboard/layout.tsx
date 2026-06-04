"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBarProvider, useTopBar } from "@/components/dashboard/top-bar-context";
import { AnimatePresence, motion } from "framer-motion";
import { pageVariants } from "@/components/motion";
import { useAuth } from "@/components/auth/auth-provider";

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
    <header className="h-11 flex items-center gap-3 px-5 border-b border-white/6 flex-shrink-0" style={{ background: "hsl(242 44% 10% / 50%)" }}>
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 overflow-auto p-6"
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
        <TopBarProvider>
          <DashboardShell>{children}</DashboardShell>
        </TopBarProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
