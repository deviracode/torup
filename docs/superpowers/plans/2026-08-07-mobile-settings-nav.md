# Mobile Settings Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Settings (and Billing) on the dashboard's mobile nav via a More (⋯) menu, so every nav destination is reachable on small screens.

**Architecture:** One-file change in the Next.js dashboard shell. The mobile top bar in `sidebar.tsx` keeps its 4 icon shortcuts, replaces the standalone Sign-out icon with a `MoreHorizontal` toggle button, and renders a dropdown (Billing, Settings, Sign out) using the same click-outside + dropdown styling patterns already used by the business switcher in the same file.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, lucide-react, framer-motion (existing, untouched).

**Spec:** `docs/superpowers/specs/2026-08-07-mobile-settings-nav-design.md`

**Note on tests:** `apps/web` has no test framework or test files (no jest/vitest in `package.json`; `lint` and `type-check` are both `tsc --noEmit`). This plan does not add test infrastructure — verification is typecheck + manual browser checks. Worktree: implementation happens in the feature worktree per user instruction; commands below assume you are in the worktree root.

---

### Task 1: Add More menu to mobile top bar

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add the `MoreHorizontal` import**

In `apps/web/src/components/dashboard/sidebar.tsx:9`, change the lucide-react import to include `MoreHorizontal`:

```tsx
import { Calendar, Users, Scissors, Settings, BarChart3, CreditCard, LogOut, Building2, ChevronDown, MoreHorizontal } from "lucide-react";
```

- [ ] **Step 2: Add menu state and click-outside handling**

In `apps/web/src/components/dashboard/sidebar.tsx:37-38`, after the `switcherRef` line, add the More-menu state:

```tsx
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
```

Then in the existing `useEffect` (lines 40-48), extend `handleClick` to also close the More menu when clicking outside it:

```tsx
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
```

- [ ] **Step 3: Replace the mobile nav block**

Replace the entire mobile nav section (currently `apps/web/src/components/dashboard/sidebar.tsx:166-191`, from the `{/* Nav icons — max 4 to avoid overflow */}` comment through the closing `</nav>`) with:

```tsx
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
```

The old standalone Sign-out button is removed — Sign out now lives inside the More dropdown.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: exit code 0, no output.

- [ ] **Step 5: Manual verification in browser**

Run: `pnpm --filter web dev` (or reuse an existing dev server) and verify at mobile widths (DevTools device toolbar, ≤ 640px, viewport `http://localhost:3000/he/dashboard`):

1. Top bar shows: logo, Calendar, Customers, Services, Analytics icons, and a **⋯** button. No standalone Sign-out icon.
2. Tap **⋯**: dropdown opens below the button containing **חיוב** (Billing), **הגדרות** (Settings), **יציאה** (Sign out) — in Hebrew locale, aligned to the left edge of the button (RTL-safe).
3. Tap **הגדרות**: navigates to `/he/dashboard/settings`, the settings page renders, and the **⋯** button shows the active highlight (indigo tint).
4. Navigate to `/he/dashboard/billing` (via ⋯ → חיוב): **⋯** stays highlighted.
5. Navigate back to `/he/dashboard`: **⋯** loses highlight.
6. Tap **⋯** then tap anywhere outside: dropdown closes.
7. Repeat 1–6 with the `/en/dashboard` locale (English labels, dropdown aligned right edge).
8. On a narrow viewport (~320px), no icons wrap or overflow horizontally.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar.tsx
git commit -m "feat(web): expose settings/billing via More menu on mobile nav"
```
