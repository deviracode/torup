"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@torup/ui";
import {
  Calendar,
  Users,
  Scissors,
  Settings,
  BarChart3,
  CreditCard,
  LogOut,
} from "lucide-react";

const navItems = [
  { key: "calendar",   href: "/dashboard",            icon: Calendar   },
  { key: "customers",  href: "/dashboard/customers",  icon: Users      },
  { key: "services",   href: "/dashboard/services",   icon: Scissors   },
  { key: "analytics",  href: "/dashboard/analytics",  icon: BarChart3  },
  { key: "billing",    href: "/dashboard/billing",    icon: CreditCard },
  { key: "settings",   href: "/dashboard/settings",   icon: Settings   },
];

const NAV_LABELS: Record<string, { he: string; en: string }> = {
  calendar:  { he: "לוח",     en: "Calendar"  },
  customers: { he: "לקוחות",  en: "Customers" },
  services:  { he: "שירותים", en: "Services"  },
  analytics: { he: "אנליטיקס",en: "Analytics" },
  billing:   { he: "חיוב",    en: "Billing"   },
  settings:  { he: "הגדרות",  en: "Settings"  },
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
    <TooltipProvider delayDuration={200}>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex h-screen w-[52px] flex-col items-center py-4 gap-1 bg-[hsl(242_44%_10%)] ${isRtl ? "border-l" : "border-r"} border-white/6 flex-shrink-0`}
      >
        {/* Logo mark */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="mb-4 w-[34px] h-[34px] rounded-[10px] cursor-pointer flex-shrink-0"
              style={{ background: "var(--grad-primary)" }}
              onClick={() => router.push(`/${locale}/dashboard`)}
              role="link"
              aria-label="TorUp home"
            />
          </TooltipTrigger>
          <TooltipContent side={isRtl ? "left" : "right"}>TorUp</TooltipContent>
        </Tooltip>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    {active && (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className="absolute inset-0 rounded-[10px]"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))",
                          boxShadow: "0 0 0 1px rgba(99,102,241,0.4)",
                        }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <button
                      onClick={() => router.push(`/${locale}${item.href}`)}
                      aria-label={label(item.key)}
                      className="relative z-10 w-[36px] h-[36px] rounded-[10px] flex items-center justify-center transition-colors hover:bg-white/8"
                    >
                      <Icon
                        className={`h-[18px] w-[18px] transition-colors ${
                          active ? "text-[#a78bfa]" : "text-white/40 hover:text-white/70"
                        }`}
                      />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side={isRtl ? "left" : "right"}>
                  {label(item.key)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => signOut()}
              aria-label={isRtl ? "יציאה" : "Sign out"}
              className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side={isRtl ? "left" : "right"}>
            {isRtl ? "יציאה" : "Sign out"}
          </TooltipContent>
        </Tooltip>
      </aside>

      {/* Mobile: top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/6 bg-[hsl(242_44%_10%)] px-4 md:hidden">
        <button
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="w-8 h-8 rounded-lg flex-shrink-0"
          style={{ background: "var(--grad-primary)" }}
          aria-label="TorUp"
        />
        <span
          className="text-lg font-black tracking-tight"
          style={{
            background: "var(--grad-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TorUp
        </span>
        <nav className="flex items-center gap-1 ms-auto">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => router.push(`/${locale}${item.href}`)}
                aria-label={label(item.key)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? "bg-primary/20 text-[#a78bfa]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          <button
            onClick={() => signOut()}
            aria-label={isRtl ? "יציאה" : "Sign out"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </TooltipProvider>
  );
}
