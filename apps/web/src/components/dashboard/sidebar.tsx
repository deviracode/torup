"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { motion } from "framer-motion";
import { Calendar, Users, Scissors, Settings, BarChart3, CreditCard, LogOut } from "lucide-react";

const navItems = [
  { key: "calendar",   href: "/dashboard",            icon: Calendar   },
  { key: "customers",  href: "/dashboard/customers",  icon: Users      },
  { key: "services",   href: "/dashboard/services",   icon: Scissors   },
  { key: "analytics",  href: "/dashboard/analytics",  icon: BarChart3  },
  { key: "billing",    href: "/dashboard/billing",    icon: CreditCard },
  { key: "settings",   href: "/dashboard/settings",   icon: Settings   },
];

const NAV_LABELS: Record<string, { he: string; en: string }> = {
  calendar:  { he: "לוח שנה",  en: "Calendar"  },
  customers: { he: "לקוחות",   en: "Customers" },
  services:  { he: "שירותים",  en: "Services"  },
  analytics: { he: "אנליטיקס", en: "Analytics" },
  billing:   { he: "חיוב",     en: "Billing"   },
  settings:  { he: "הגדרות",   en: "Settings"  },
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { signOut } = useAuth();
  const isRtl = locale === "he" || locale === "ar";

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname.endsWith("/dashboard")
      : pathname.includes(href);
  }

  const label = (key: string) =>
    isRtl ? NAV_LABELS[key].he : NAV_LABELS[key].en;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex h-screen w-[220px] flex-col py-4 bg-[hsl(242_44%_10%)] ${isRtl ? "border-l" : "border-r"} border-white/6 flex-shrink-0`}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 px-4 mb-6 cursor-pointer"
          onClick={() => router.push(`/${locale}/dashboard`)}
        >
          <div
            className="w-8 h-8 rounded-[8px] flex-shrink-0"
            style={{ background: "var(--grad-primary)" }}
          />
          <span
            className="text-base font-black tracking-tight"
            style={{
              background: "var(--grad-brand)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            TorUp
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <div key={item.key} className="relative">
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute inset-0 rounded-[10px]"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))",
                      boxShadow: "0 0 0 1px rgba(99,102,241,0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <button
                  onClick={() => router.push(`/${locale}${item.href}`)}
                  aria-label={label(item.key)}
                  className={`relative z-10 w-full flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${isRtl ? "text-right" : "text-left"} ${
                    active
                      ? "text-[#a78bfa]"
                      : "text-white/45 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{label(item.key)}</span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pt-2 border-t border-white/6">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>{isRtl ? "יציאה" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/6 bg-[hsl(242_44%_10%)] px-3 md:hidden">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="w-8 h-8 rounded-lg"
            style={{ background: "var(--grad-primary)" }}
            aria-label="TorUp"
          />
          <span
            className="text-base font-black tracking-tight"
            style={{
              background: "var(--grad-brand)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            TorUp
          </span>
        </div>

        {/* Nav icons — max 4 to avoid overflow */}
        <nav className="flex items-center gap-0.5">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => router.push(`/${locale}${item.href}`)}
                aria-label={label(item.key)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  active ? "bg-primary/20 text-[#a78bfa]" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            );
          })}
          <button
            onClick={() => signOut()}
            aria-label={isRtl ? "יציאה" : "Sign out"}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </nav>
      </div>
    </>
  );
}
