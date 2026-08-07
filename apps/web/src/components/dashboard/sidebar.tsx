"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/components/auth/business-provider";
import { motion } from "framer-motion";
import Image from "next/image";
import { Calendar, Users, Scissors, Settings, BarChart3, CreditCard, LogOut, Building2, ChevronDown, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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
  const { businessId, businesses, switchBusiness } = useBusiness();
  const isRtl = locale === "he" || locale === "ar";
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentBusiness = businesses.find((b) => b.businessId === businessId);

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
        className="hidden md:flex h-screen w-[220px] flex-col py-4 bg-[hsl(242_44%_10%)] border-e border-white/6 flex-shrink-0"
      >
        {/* Logo */}
        <div
          className="flex justify-center px-4 mb-6 cursor-pointer"
          onClick={() => router.push(`/${locale}/dashboard`)}
        >
          <Image src="/logo.png" alt="TorUp" width={200} height={100} className="object-contain" priority />
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
                        "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))",
                      boxShadow: "0 0 0 1px rgba(99,102,241,0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <button
                  onClick={() => router.push(`/${locale}${item.href}`)}
                  aria-label={label(item.key)}
                  className={`relative z-10 w-full flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-start transition-colors ${
                    active
                      ? "text-[#818cf8]"
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

        {/* Business switcher — only show when user has multiple businesses */}
        {businesses.length > 1 && (
          <div className="px-3 pb-2" ref={switcherRef}>
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="w-full flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate text-start">{currentBusiness?.name ?? "..."}</span>
                <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
              </button>
              {switcherOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-[10px] border border-white/8 bg-[hsl(242_44%_10%)] shadow-lg overflow-hidden z-50">
                  {businesses.map((b) => (
                    <button
                      key={b.businessId}
                      onClick={() => { switchBusiness(b.businessId); setSwitcherOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        b.businessId === businessId
                          ? "text-[#818cf8] bg-white/5"
                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex-1 truncate text-start">{b.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/25">{b.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
          <button onClick={() => router.push(`/${locale}/dashboard`)} aria-label="TorUp">
            <Image src="/logo.png" alt="TorUp" width={80} height={40} className="object-contain" priority />
          </button>
        </div>

        {/* Nav icons — max 4 to avoid overflow; rest live in More menu */}
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
                  active ? "bg-primary/20 text-[#818cf8]" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            );
          })}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              aria-label={isRtl ? "עוד" : "More"}
              aria-expanded={moreOpen}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                moreOpen || ["/dashboard/billing", "/dashboard/settings"].some((p) => pathname.includes(p))
                  ? "bg-primary/20 text-[#818cf8]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
            {moreOpen && (
              <div className="absolute top-full end-0 mt-1 w-44 rounded-[10px] border border-white/8 bg-[hsl(242_44%_10%)] shadow-lg overflow-hidden z-50">
                {navItems.slice(4).map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => { router.push(`/${locale}${item.href}`); setMoreOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                        active ? "text-[#818cf8] bg-white/5" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{label(item.key)}</span>
                    </button>
                  );
                })}
                <div className="border-t border-white/6">
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span>{isRtl ? "יציאה" : "Sign out"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
