# TorUp UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire TorUp frontend to a Bold & Vibrant aesthetic — deep indigo/purple backgrounds, gradient accents, icon-only sidebar, and a three-layer animation system (smooth stagger + spring physics + micro-interactions) using Framer Motion.

**Architecture:** CSS custom property tokens in `globals.css` drive the dark theme across all shadcn components automatically. Framer Motion `variants` + `AnimatePresence` handle page transitions and mount animations. A `TopBarContext` lets each dashboard page inject its action button into the shared top header bar.

**Tech Stack:** Next.js 15 App Router · Tailwind CSS v4 · Framer Motion · shadcn/ui · Lucide React · next-intl

---

## File Map

| File | Action |
|---|---|
| `apps/web/package.json` | Add `framer-motion` |
| `apps/web/src/app/globals.css` | Replace light tokens with dark theme tokens + gradient vars |
| `apps/web/src/components/motion.tsx` | NEW — shared animation variants + `useMotionConfig` hook |
| `apps/web/src/components/dashboard/top-bar-context.tsx` | NEW — TopBar context provider |
| `apps/web/src/components/dashboard/top-bar-slot.tsx` | NEW — component pages render to inject actions |
| `apps/web/src/components/dashboard/sidebar.tsx` | Full rewrite — icon-only, tooltips, layoutId indicator |
| `apps/web/src/app/[locale]/dashboard/layout.tsx` | Add TopBarProvider, top header bar, AnimatePresence |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Animated stat cards + count-up numbers |
| `apps/web/src/components/dashboard/daily-calendar.tsx` | Dark status colors + stagger slot animations |
| `apps/web/src/components/dashboard/weekly-calendar.tsx` | Dark status colors + stagger slot animations |
| `apps/web/src/app/[locale]/(auth)/layout.tsx` | Split-panel brand + form layout |
| `apps/web/src/app/[locale]/(auth)/login/page.tsx` | Rewrite using new auth layout slots |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Rewrite using new auth layout slots |
| `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` | Rewrite using new auth layout slots |
| `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` | Rewrite using new auth layout slots |
| `apps/web/src/app/[locale]/page.tsx` | Full rewrite — landing page with orbs, hero, features |

---

## Task 1: Install Framer Motion + Dark Theme CSS Tokens

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add framer-motion**

```bash
cd apps/web && pnpm add framer-motion
```

Expected: `framer-motion` appears in `apps/web/package.json` dependencies.

- [ ] **Step 2: Replace globals.css with dark theme tokens**

Replace the entire contents of `apps/web/src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  /* ── Backgrounds ── */
  --color-background: hsl(244 93% 5%);
  --color-foreground: hsl(214 32% 91%);

  /* ── Cards / Surfaces ── */
  --color-card: hsl(244 40% 16%);
  --color-card-foreground: hsl(214 32% 91%);
  --color-popover: hsl(242 44% 10%);
  --color-popover-foreground: hsl(214 32% 91%);

  /* ── Primary (indigo) ── */
  --color-primary: hsl(239 84% 67%);
  --color-primary-foreground: hsl(0 0% 100%);

  /* ── Secondary ── */
  --color-secondary: hsl(244 40% 16%);
  --color-secondary-foreground: hsl(258 91% 76%);

  /* ── Muted ── */
  --color-muted: hsl(244 35% 20%);
  --color-muted-foreground: hsl(214 20% 60%);

  /* ── Accent (violet) ── */
  --color-accent: hsl(262 83% 66%);
  --color-accent-foreground: hsl(0 0% 100%);

  /* ── Semantic ── */
  --color-destructive: hsl(0 84% 60%);
  --color-destructive-foreground: hsl(0 0% 98%);
  --color-success: hsl(160 84% 39%);
  --color-success-foreground: hsl(0 0% 100%);
  --color-warning: hsl(38 92% 50%);
  --color-warning-foreground: hsl(0 0% 100%);

  /* ── Chrome ── */
  --color-border: hsl(244 30% 22%);
  --color-input: hsl(244 40% 18%);
  --color-ring: hsl(239 84% 67%);

  /* ── Radii ── */
  --radius-sm: 0.5rem;
  --radius-md: 0.625rem;
  --radius-lg: 0.75rem;
}

/* ── Gradient custom properties (not Tailwind tokens) ── */
:root {
  --grad-primary: linear-gradient(135deg, #6366f1, #8b5cf6);
  --grad-brand: linear-gradient(135deg, #a78bfa, #f472b6);
  --grad-warm: linear-gradient(135deg, #f472b6, #fb923c);
  --grad-success: linear-gradient(135deg, #10b981, #06b6d4);
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}

/* ── Floating orb keyframes (landing page, no JS needed) ── */
@keyframes orb-float-1 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, 40px) scale(1.12); }
}
@keyframes orb-float-2 {
  0% { transform: translate(0, 0) scale(1.1); }
  100% { transform: translate(-25px, 30px) scale(1); }
}
@keyframes orb-float-3 {
  0% { transform: translateX(-50%) scale(1); }
  100% { transform: translateX(-42%) scale(1.15); }
}
.orb-1 { animation: orb-float-1 8s ease-in-out infinite alternate; }
.orb-2 { animation: orb-float-2 10s ease-in-out infinite alternate; }
.orb-3 { animation: orb-float-3 7s ease-in-out infinite alternate; }
```

- [ ] **Step 3: Verify the app still starts**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/en` — the page should render with the dark background. shadcn cards and buttons will automatically pick up the new colors. Check there are no build errors in the terminal.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/app/globals.css pnpm-lock.yaml
git commit -m "feat: install framer-motion and apply dark theme tokens"
```

---

## Task 2: Shared Animation Utilities

**Files:**
- Create: `apps/web/src/components/motion.tsx`

- [ ] **Step 1: Create the shared motion utilities file**

Create `apps/web/src/components/motion.tsx`:

```tsx
"use client";

import { useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";

/**
 * Returns Framer Motion transition/variant config respecting
 * prefers-reduced-motion and RTL direction.
 */
export function useMotionConfig() {
  const shouldReduce = useReducedMotion();
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const dir = isRtl ? -1 : 1; // flip x-based animations for RTL

  return { shouldReduce, dir };
}

/** Stagger container variant */
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/** Child variant for spring-mount (stat cards, list items) */
export const springItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

/** Child variant for smooth fade-up (hero text, feature cards) */
export const fadeUpItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** Tight stagger for calendar rows (0.03s between rows) */
export const calendarRowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

export const calendarRowItem = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** Page transition (used in AnimatePresence) */
export const pageVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.2, ease: "easeIn" } },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/motion.tsx
git commit -m "feat: add shared Framer Motion variants and useMotionConfig"
```

---

## Task 3: Sidebar Rewrite — Icon-Only with Tooltips

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

The new sidebar is 52px wide, icon-only. The active nav indicator uses Framer Motion `layoutId` so it smoothly slides between items.

- [ ] **Step 1: Rewrite sidebar.tsx**

```tsx
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
    const full = `/${locale}${href}`;
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
```

- [ ] **Step 2: Verify in browser**

Run `pnpm dev` and open a dashboard page. The sidebar should be 52px wide, icon-only, with tooltips on hover and the active indicator animating between items when you navigate.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar.tsx
git commit -m "feat: icon-only sidebar with spring layoutId active indicator"
```

---

## Task 4: Dashboard Layout — Top Bar + AnimatePresence

**Files:**
- Create: `apps/web/src/components/dashboard/top-bar-context.tsx`
- Create: `apps/web/src/components/dashboard/top-bar-slot.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/layout.tsx`

- [ ] **Step 1: Create TopBarContext**

Create `apps/web/src/components/dashboard/top-bar-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface TopBarCtx {
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
}

const TopBarContext = createContext<TopBarCtx>({
  actions: null,
  setActions: () => {},
});

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <TopBarContext.Provider value={{ actions, setActions }}>
      {children}
    </TopBarContext.Provider>
  );
}

export const useTopBar = () => useContext(TopBarContext);
```

- [ ] **Step 2: Create TopBarSlot**

Create `apps/web/src/components/dashboard/top-bar-slot.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTopBar } from "./top-bar-context";

export function TopBarSlot({ children }: { children: ReactNode }) {
  const { setActions } = useTopBar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, []);
  return null;
}
```

- [ ] **Step 3: Rewrite dashboard layout**

Replace `apps/web/src/app/[locale]/dashboard/layout.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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

  const rawPath = Object.keys(PAGE_TITLES).find((p) =>
    pathname.endsWith(p) || pathname.includes(p.replace("/dashboard", ""))
  ) ?? "/dashboard";
  const title = isRtl
    ? PAGE_TITLES[rawPath]?.he ?? "Dashboard"
    : PAGE_TITLES[rawPath]?.en ?? "Dashboard";

  const initials = session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="h-11 flex items-center gap-3 px-5 border-b border-white/6 bg-[hsl(242_44%_10%)/50] flex-shrink-0">
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
```

- [ ] **Step 4: Verify in browser**

Navigate between dashboard pages — the top bar should show the current page title, and the content should fade+slide during transitions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/top-bar-context.tsx \
        apps/web/src/components/dashboard/top-bar-slot.tsx \
        "apps/web/src/app/[locale]/dashboard/layout.tsx"
git commit -m "feat: dashboard layout with top bar, TopBarSlot, and AnimatePresence page transitions"
```

---

## Task 5: Dashboard Page — Animated Stat Cards + Count-Up

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

Replace `apps/web/src/app/[locale]/dashboard/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { DailyCalendar } from "@/components/dashboard/daily-calendar";
import { WeeklyCalendar } from "@/components/dashboard/weekly-calendar";
import { NewAppointmentForm } from "@/components/dashboard/new-appointment-form";
import { TopBarSlot } from "@/components/dashboard/top-bar-slot";
import { motion, useSpring, useTransform, useMotionValue, useReducedMotion } from "framer-motion";
import { staggerContainer, springItem } from "@/components/motion";
import { CalendarDays, Clock, CheckCircle2, AlertCircle, Plus } from "lucide-react";

interface DayStats {
  total: number;
  pending: number;
  completed: number;
  pendingApproval: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const shouldReduce = useReducedMotion();
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    if (shouldReduce) {
      motionVal.set(value);
    } else {
      motionVal.set(value);
    }
  }, [value, motionVal, shouldReduce]);

  return <motion.span>{display}</motion.span>;
}

const STAT_CONFIG = [
  {
    key: "total" as const,
    labelKey: "todayAppointments",
    icon: CalendarDays,
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    accentColor: "#6366f1",
  },
  {
    key: "pending" as const,
    labelKey: "pending",
    icon: Clock,
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    accentColor: "#f59e0b",
    badgeKey: "pendingApproval" as const,
  },
  {
    key: "completed" as const,
    labelKey: "completed",
    icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
    accentColor: "#10b981",
  },
  {
    key: "pendingApproval" as const,
    labelKey: "pendingApproval",
    icon: AlertCircle,
    gradient: "linear-gradient(135deg, #ef4444, #f472b6)",
    accentColor: "#ef4444",
  },
];

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const { session } = useAuth();
  const [view, setView] = useState<"day" | "week">("day");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<DayStats>({
    total: 0,
    pending: 0,
    completed: 0,
    pendingApproval: 0,
  });

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ id: string }>("/api/businesses/me", {}, session.access_token)
      .then((r) => { if (r.id) setBusinessId(r.id); })
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (!businessId || !session?.access_token) return;
    const today = new Date().toISOString().split("T")[0];

    apiFetch<Array<{ status: string }>>(
      `/api/businesses/${businessId}/appointments?date=${today}`,
      {},
      session.access_token
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({
          ...prev,
          total: apts.length,
          pending: apts.filter((a) => a.status === "pending" || a.status === "confirmed").length,
          completed: apts.filter((a) => a.status === "completed").length,
        }));
      }
    }).catch(() => {});

    apiFetch<Array<{ id: string }>>(
      `/api/businesses/${businessId}/appointments?status=pending_approval`,
      {},
      session.access_token
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({ ...prev, pendingApproval: apts.length }));
      }
    }).catch(() => {});
  }, [businessId, session?.access_token, refreshKey]);

  return (
    <div>
      {/* Inject "New Appointment" button into the top bar */}
      {businessId && (
        <TopBarSlot>
          <motion.button
            onClick={() => setShowNewAppt(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold text-white"
            style={{ background: "var(--grad-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newAppointment")}
          </motion.button>
        </TopBarSlot>
      )}

      {/* Stat Cards */}
      {businessId && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          {STAT_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <motion.div
                key={cfg.key}
                variants={springItem}
                className="rounded-xl p-4 border border-white/8"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div
                  className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center mb-3"
                  style={{ background: cfg.gradient }}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    <AnimatedNumber value={stats[cfg.key]} />
                  </span>
                  {cfg.badgeKey && stats[cfg.badgeKey] > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {stats[cfg.badgeKey]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5">{t(cfg.labelKey as Parameters<typeof t>[0])}</p>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* View toggle + calendar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex rounded-lg overflow-hidden border border-white/8">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === v
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
              style={
                view === v
                  ? { background: "var(--grad-primary)" }
                  : { background: "transparent" }
              }
            >
              {v === "day" ? t("dayView") : t("weekView")}
            </button>
          ))}
        </div>
      </div>

      {!businessId ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-4 w-12 rounded bg-white/8" />
              <div className="h-10 flex-1 rounded-lg bg-white/8" />
            </div>
          ))}
        </div>
      ) : view === "day" ? (
        <DailyCalendar key={`day-${refreshKey}`} businessId={businessId} />
      ) : (
        <WeeklyCalendar key={`week-${refreshKey}`} businessId={businessId} />
      )}

      {showNewAppt && businessId && (
        <NewAppointmentForm
          businessId={businessId}
          onClose={() => setShowNewAppt(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open the dashboard — stat cards should spring in with stagger, numbers should animate from 0 to actual values. The "New Appointment" button should appear in the top bar.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/dashboard/page.tsx"
git commit -m "feat: dashboard page with spring stat cards and count-up numbers"
```

---

## Task 6: Daily Calendar — Dark Status Colors + Stagger Animations

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`

- [ ] **Step 1: Replace STATUS_COLORS with dark-mode palette**

Find the `STATUS_COLORS` constant in `apps/web/src/components/dashboard/daily-calendar.tsx` (around line 28) and replace it:

```tsx
const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-orange-500/15 border-orange-400/60 text-orange-300",
  pending:          "bg-yellow-500/15 border-yellow-400/60 text-yellow-300",
  confirmed:        "bg-indigo-500/15 border-indigo-400/60 text-indigo-300",
  in_progress:      "bg-violet-500/15 border-violet-400/60 text-violet-300",
  completed:        "bg-emerald-500/15 border-emerald-400/60 text-emerald-300",
  cancelled:        "bg-white/5 border-white/15 text-white/30",
  no_show:          "bg-red-500/15 border-red-400/60 text-red-300",
};
```

- [ ] **Step 2: Add Framer Motion stagger to the hours list**

At the top of `daily-calendar.tsx`, add the import:

```tsx
import { motion } from "framer-motion";
import { calendarRowContainer, calendarRowItem } from "@/components/motion";
```

Find where the component renders the list of hour rows (the JSX that maps over `hours`). It will look roughly like:

```tsx
<div className="...">
  {hours.map((hour) => (
    <div key={hour} className="flex ...">
      ...
    </div>
  ))}
</div>
```

Wrap the outer `div` with `motion.div` using `calendarRowContainer` and each row `div` with `motion.div` using `calendarRowItem`:

```tsx
<motion.div
  variants={calendarRowContainer}
  initial="hidden"
  animate="show"
  className="..." {/* keep existing className */}
>
  {hours.map((hour) => (
    <motion.div key={hour} variants={calendarRowItem} className="flex ...">
      {/* existing row content unchanged */}
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 3: Verify in browser**

Navigate to the dashboard calendar. Appointment blocks should use the dark-mode colors. Hour rows should fade in sequentially on load.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx
git commit -m "feat: daily calendar dark status colors and stagger row animations"
```

---

## Task 7: Weekly Calendar — Dark Status Colors + Stagger Animations

**Files:**
- Modify: `apps/web/src/components/dashboard/weekly-calendar.tsx`

- [ ] **Step 1: Replace STATUS_COLORS**

Find the `STATUS_COLORS` constant in `apps/web/src/components/dashboard/weekly-calendar.tsx` (around line 17) and replace it:

```tsx
const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-500/15 border-yellow-400/60 text-yellow-300",
  confirmed:   "bg-indigo-500/15 border-indigo-400/60 text-indigo-300",
  in_progress: "bg-violet-500/15 border-violet-400/60 text-violet-300",
  completed:   "bg-emerald-500/15 border-emerald-400/60 text-emerald-300",
  cancelled:   "bg-white/5 border-white/15 text-white/30",
  no_show:     "bg-red-500/15 border-red-400/60 text-red-300",
};
```

- [ ] **Step 2: Add import and stagger to hour rows**

Add at the top of `weekly-calendar.tsx`:

```tsx
import { motion } from "framer-motion";
import { calendarRowContainer, calendarRowItem } from "@/components/motion";
```

Find the JSX that maps over `HOURS` (the `Array.from({ length: 14 }, ...)` constant). Wrap the container and each row the same way as in Task 6:

```tsx
<motion.div
  variants={calendarRowContainer}
  initial="hidden"
  animate="show"
  className="..." {/* keep existing className */}
>
  {HOURS.map((hour) => (
    <motion.div key={hour} variants={calendarRowItem} className="...">
      {/* existing content unchanged */}
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/weekly-calendar.tsx
git commit -m "feat: weekly calendar dark status colors and stagger animations"
```

---

## Task 8: Auth Layout — Split Panel

**Files:**
- Modify: `apps/web/src/app/[locale]/(auth)/layout.tsx`

The split layout renders a brand panel (left 45%) and a form area (right 55%). Auth pages render only their form content as `children` — the brand panel is shared.

- [ ] **Step 1: Rewrite auth layout**

Replace `apps/web/src/app/[locale]/(auth)/layout.tsx`:

```tsx
"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Check } from "lucide-react";

const FEATURES = [
  { icon: "📅", he: "ניהול תורים אוטומטי",        en: "Automated appointment scheduling" },
  { icon: "💬", he: "בוט WhatsApp עם בינה מלאכותית", en: "AI-powered WhatsApp bot"           },
  { icon: "📊", he: "אנליטיקס בזמן אמת",           en: "Real-time analytics dashboard"     },
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
```

- [ ] **Step 2: Verify in browser**

Open `/en/login` — the brand panel should slide in from the left, the form from below, with spring physics.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/(auth)/layout.tsx"
git commit -m "feat: auth split-panel layout with brand panel and spring form entrance"
```

---

## Task 9: Auth Form Pages — Login, Register, Forgot Password, Reset Password

**Files:**
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`

All four pages share the same visual treatment: dark form with styled inputs. The layout provides the animation wrapper; the pages only render the form content.

- [ ] **Step 1: Create a shared styled input component inline**

Each form page will use this pattern for inputs (no new file needed — inline CSS classes):

```tsx
// Dark styled input classes (used in all auth pages):
// "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90
//  placeholder:text-white/30 outline-none transition-all duration-200
//  focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20"
```

- [ ] **Step 2: Rewrite login/page.tsx**

Replace `apps/web/src/app/[locale]/(auth)/login/page.tsx`:

```tsx
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
      // Shake animation on error
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
              {t("forgotPassword")}
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
```

- [ ] **Step 3: Rewrite register/page.tsx**

Replace `apps/web/src/app/[locale]/(auth)/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { motion, useAnimate } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function RegisterPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
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
      await signUp(email, password, name);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      animate(scope.current, { x: [0, 10, -10, 6, -6, 0] }, { duration: 0.4 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm" ref={scope}>
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "צור חשבון" : "Create an account"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "הצטרף ל-TorUp היום" : "Join TorUp today"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60" htmlFor="name">
            {isRtl ? "שם מלא" : "Full Name"}
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("register")}
        </motion.button>
      </form>

      <p className="mt-5 text-center text-sm text-white/40">
        <Link href={`/${locale}/login`} className="text-[#a78bfa] hover:text-white transition-colors">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite forgot-password/page.tsx**

Replace `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function ForgotPasswordPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--grad-success)" }}>
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isRtl ? "נשלח!" : "Check your email"}
        </h2>
        <p className="text-sm text-white/40 mb-6">{t("resetLinkSent")}</p>
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "איפוס סיסמה" : "Reset password"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "נשלח לך קישור לאיפוס" : "We'll send you a reset link"}
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
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("sendResetLink")}
        </motion.button>
      </form>

      <p className="mt-5 text-center">
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite reset-password/page.tsx**

Replace `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { motion } from "framer-motion";
import Link from "next/link";

const inputClass =
  "w-full rounded-[10px] bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-[#6366f1] focus:bg-[#6366f1]/8 focus:ring-2 focus:ring-[#6366f1]/20";

export default function ResetPasswordPage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const establish = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setError(error.message);
      } else if (window.location.hash.includes("access_token")) {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
      setReady(true);
    };
    establish();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setUpdated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (updated) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--grad-success)" }}>
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isRtl ? "הסיסמה עודכנה" : "Password updated"}
        </h2>
        <p className="text-sm text-white/40 mb-6">{t("passwordUpdated")}</p>
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-white mb-1">
        {isRtl ? "סיסמה חדשה" : "New password"}
      </h2>
      <p className="text-sm text-white/40 mb-6">
        {isRtl ? "בחר סיסמה חדשה לחשבונך" : "Choose a new password for your account"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {!ready && (
          <div className="text-sm text-white/40 text-center py-2">
            {isRtl ? "מאמת קישור..." : "Verifying link..."}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60" htmlFor="password">
            {t("newPassword")}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            disabled={!ready}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading || !ready}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full rounded-[10px] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "var(--grad-primary)" }}
        >
          {loading ? t("loading") : t("resetPassword")}
        </motion.button>
      </form>

      <p className="mt-5 text-center">
        <Link href={`/${locale}/login`} className="text-sm text-[#a78bfa] hover:text-white transition-colors">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Verify all 4 auth pages in browser**

Visit `/en/login`, `/en/register`, `/en/forgot-password`. Each should show the split panel with the brand on the left and the form on the right with dark styling. Test that:
- Login submits and navigates to dashboard
- Error state triggers the shake animation
- Inputs show the focus glow on click

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/[locale]/(auth)/login/page.tsx" \
        "apps/web/src/app/[locale]/(auth)/register/page.tsx" \
        "apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx" \
        "apps/web/src/app/[locale]/(auth)/reset-password/page.tsx"
git commit -m "feat: auth pages redesign with dark form, focus glow, and error shake"
```

---

## Task 10: Landing Page — Full Rewrite

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`

- [ ] **Step 1: Rewrite the landing page**

Replace `apps/web/src/app/[locale]/page.tsx`:

```tsx
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
      {/* ── Ambient background orbs ── */}
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

      {/* ── Navbar ── */}
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

      {/* ── Hero ── */}
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
        </motion.variants>

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

      {/* ── Features ── */}
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
                key={i}
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

      {/* ── Footer ── */}
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/en`:
- Background orbs should be floating
- Navbar fades down on load
- Badge pill springs in
- Headline and subtitle fade up with stagger
- Feature cards slide up when scrolled into view
- Hovering feature cards lifts them with spring physics
- Buttons scale on hover/tap

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/page.tsx"
git commit -m "feat: landing page redesign with orbs, hero animations, and scroll-triggered features"
```

---

## Final Verification

- [ ] Run `pnpm build` in `apps/web` — confirm no TypeScript errors
- [ ] Test all 3 locales: `/en`, `/he`, `/ar` — RTL layout should flip correctly
- [ ] Navigate through all dashboard pages and confirm page transition animations work
- [ ] Test login with wrong password — confirm shake animation fires
- [ ] Confirm `prefers-reduced-motion` is respected: in browser DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" — animations should be minimal
- [ ] Commit final cleanup if needed:

```bash
git add -p
git commit -m "feat: complete Bold & Vibrant UI redesign with Framer Motion"
```
