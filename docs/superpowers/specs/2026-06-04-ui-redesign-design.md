# TorUp UI Redesign — Design Spec

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Full app — Landing page, Auth pages (login/register/forgot/reset), Dashboard shell + all dashboard pages

---

## 1. Vision

Redesign TorUp's entire frontend to a **Bold & Vibrant** aesthetic: deep purple/indigo backgrounds, gradient accents, icon-only sidebar, and a layered animation system (smooth stagger + spring physics + micro-interactions). The result should feel like a high-end SaaS product — Stripe or Raycast quality — not a utility app.

---

## 2. Design Direction

**Style:** Bold & Vibrant  
- Deep `#060612` background, `#0f0e24` surface, `#1a1838` cards  
- Primary: indigo `#6366f1` → violet `#8b5cf6`  
- Brand gradient: violet `#a78bfa` → pink `#f472b6`  
- Semantic: success `#10b981`, warning `#f59e0b`, danger `#ef4444`, info `#06b6d4`  

**Animation library:** Framer Motion (new dependency)  
**Animation styles:** Smooth & Purposeful + Physics & Spring + Micro-interactions  

---

## 3. Color Token System

All colors defined as CSS custom properties in `apps/web/src/app/globals.css`:

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#060612` | Page background |
| `--surface` | `#0f0e24` | Sidebar, modals |
| `--card` | `#1a1838` | Cards, inputs |
| `--border` | `rgba(255,255,255,0.06)` | All borders |
| `--border-hover` | `rgba(255,255,255,0.12)` | Hover borders |
| `--text` | `#e2e8f0` | Primary text |
| `--text-muted` | `rgba(255,255,255,0.40)` | Secondary text |
| `--primary` | `#6366f1` | Buttons, active states |
| `--primary-light` | `#a78bfa` | Accents, icons |
| `--accent-pink` | `#f472b6` | Brand gradient end |
| `--success` | `#10b981` | Completed status |
| `--warning` | `#f59e0b` | Pending status |
| `--danger` | `#ef4444` | Cancelled/error |
| `--info` | `#06b6d4` | Info badges |

**Signature gradients:**
- `--grad-primary`: `linear-gradient(135deg, #6366f1, #8b5cf6)` — buttons, icons
- `--grad-brand`: `linear-gradient(135deg, #a78bfa, #f472b6)` — logo, display text
- `--grad-warm`: `linear-gradient(135deg, #f472b6, #fb923c)` — warm accents
- `--grad-success`: `linear-gradient(135deg, #10b981, #06b6d4)` — success states

---

## 4. Typography

Font: **Geist** (already loaded via `next/font`)

| Role | Weight | Size | Letter-spacing |
|---|---|---|---|
| Display | 900 | 56px | -2px |
| H1 | 800 | 36px | -1px |
| H2 | 700 | 24px | -0.5px |
| H3 / Label | 600 | 14px | 0 |
| Body | 400 | 14px | 0 |
| Caption | 500 | 11px | +1px |

Display and H1 headings use `--grad-brand` as a CSS gradient clip on the landing page and auth brand panel.

---

## 5. Layout Structure

### 5.1 Landing Page

- Full-screen dark hero (`min-h-screen`, `#060612` bg)
- **Navbar:** logo left, nav links center, CTA button right; sticky, `border-b border-white/6`
- **3 ambient orbs:** blurred gradient circles (`filter: blur(60px)`) positioned top-left, top-right, bottom-center; CSS `@keyframes` float animation; no JS
- **Hero section:** centered, badge pill → gradient headline → subtitle → two CTA buttons (`Start Free` primary, `See Demo` outline) → feature chips row
- **Feature section:** 2×2 grid of cards with gradient border on hover, icon, title, description; `whileInView` stagger animation
- **Footer:** minimal, `border-t`, links + copyright

### 5.2 Auth Pages (Login, Register, Forgot Password, Reset Password)

- **Split layout:** left 45% brand panel + right 55% form
- **Brand panel:** `--grad-primary` background with radial orb, TorUp logo in `--grad-brand`, tagline, 3 feature list items with gradient icon boxes
- **Form panel:** dark `--bg`, centered content, title + subtitle, inputs with focus/error states, submit button, footer link
- All auth pages share this layout via `apps/web/src/app/[locale]/(auth)/layout.tsx`

### 5.3 Dashboard Shell

- **Icon sidebar:** 52px wide, `--surface` bg, `border-r border-white/6`
  - Top: 34×34px gradient logo mark (replaces text "TorUp")
  - Nav icons: 36×36px rounded squares, gradient active state with `layoutId` shared layout animation
  - Bottom: language picker icon + logout icon
  - Tooltips on hover (Radix Tooltip)
- **Top header bar:** 44px, `border-b border-white/6`
  - Left: breadcrumb (page name)
  - Right: page-specific action button (e.g. "New Appointment" on Calendar, "Add Customer" on Customers) + user avatar circle; button is passed as a prop from each page via a `TopBarActions` slot
- **Main content:** `flex-1 overflow-auto bg-[--bg] p-6`
- **Page transitions:** `AnimatePresence` wrapping route content, fade + x-slide between pages

### 5.4 Dashboard Pages

All inner pages inherit the shell. Key changes per page:

**Dashboard (Calendar):**
- 4 stat cards in a row (Today / Pending / Completed / Needs Approval), each with colored gradient icon, large number, label, thin accent bar
- Day/Week view toggle — pill style, gradient active state
- Calendar slots animate in row-by-row on mount

**Customers, Services, Settings, Analytics, Billing:**
- Page header with title + primary action button
- Tables/lists use the new appointment row style (gradient left border bar, hover slide-right micro-interaction)

---

## 6. Component Specifications

### Buttons

| Variant | Style |
|---|---|
| Primary | `--grad-primary` bg, white text, `box-shadow: 0 4px 15px rgba(99,102,241,0.4)` |
| Outline | transparent bg, `border border-primary/50`, `--primary-light` text |
| Ghost | `rgba(255,255,255,0.06)` bg, muted text |
| Danger | `linear-gradient(135deg, #ef4444, #f472b6)` |

All buttons: `whileTap={{ scale: 0.96 }}`, `whileHover={{ scale: 1.02 }}`

### Status Badges

| Status | Colors |
|---|---|
| Confirmed | indigo bg/border/text |
| Completed | emerald bg/border/text |
| Pending | amber bg/border/text |
| Cancelled | red bg/border/text |
| Needs Approval | pink bg/border/text |

### Form Inputs

- Default: `rgba(255,255,255,0.05)` bg, `border-white/10`
- Focus: `border-primary`, `bg-primary/8`, `ring-3 ring-primary/20`; CSS transition 200ms
- Error: `border-danger`, `bg-danger/6`, `ring-3 ring-danger/15`

### Stat Cards

- `rgba(255,255,255,0.04)` bg, `border-white/8`
- Colored left accent bar (3px, full height of card, gradient matching the metric)
- Gradient icon box (30×30px, border-radius 8px)
- Large number (900 weight), label below

### Appointment List Rows

- `rgba(255,255,255,0.04)` bg, `border-white/7`, `border-radius: 10px`
- Left: colored gradient vertical bar (3px) indicating appointment type/status
- `whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.07)' }}`

---

## 7. Animation Choreography

### 7.1 Landing Page

| Trigger | Element | Animation | API |
|---|---|---|---|
| always | Background orbs | Float continuously, different speeds | CSS `@keyframes`, GPU composited |
| 0ms | Navbar | Fade down (y: -20→0, opacity: 0→1, 0.4s) | `motion.nav` |
| 100ms | Badge pill | Pop in (scale: 0.8→1) | `spring stiffness:400 damping:20` |
| 200ms | Hero headline | Word-by-word slide up, 0.05s stagger | `variants staggerChildren:0.05` |
| 400ms | Subtitle + CTAs | Fade up (y: 16→0), 0.1s stagger | `motion.div delay:0.4` |
| scroll | Feature cards | Slide up on scroll into view, 0.1s stagger | `whileInView viewport:{once:true}` |
| hover | Feature cards | Lift (y: -4, scale: 1.02) | `whileHover spring` |
| tap | CTA buttons | Press (scale: 0.97) | `whileTap spring` |

### 7.2 Auth Pages

| Trigger | Element | Animation | API |
|---|---|---|---|
| 0ms | Brand panel | Slide in from left (x: -40→0, 0.5s) | `motion.div` |
| 150ms | Form panel | Spring up (y: 30→0) | `spring stiffness:300 damping:25` |
| focus | Inputs | Border + ring glow | CSS transition 200ms |
| error | Form | Shake (x: 0→8→-8→4→-4→0) | `useAnimate keyframes` |
| tap | Submit button | Spring press + loading spinner | `whileTap AnimatePresence` |

### 7.3 Dashboard

| Trigger | Element | Animation | API |
|---|---|---|---|
| route change | Page content | Fade + x-slide out/in | `AnimatePresence` |
| mount | Stat cards | Spring in, 0.08s stagger, scale 0.95→1 | `variants staggerChildren:0.08` |
| mount | Stat numbers | Count up 0 → value over 1s | `useMotionValue useSpring` |
| mount | Calendar slots | Fade in row by row, 0.03s stagger | `variants staggerChildren:0.03` |
| hover | Appointment rows | Slide right (x: 0→4) | `whileHover` |
| active change | Sidebar nav icon | Indicator slides between icons | `layoutId="active-indicator"` |
| tap | All buttons | Press (scale: 0.96) | `whileTap` |

---

## 8. Dependencies

**New:**
- `framer-motion` — animation library

**Existing (unchanged):**
- `tailwindcss` v4
- `@torup/ui` (shadcn primitives)
- `lucide-react`
- `tw-animate-css`

---

## 9. Files to Create / Modify

| File | Change |
|---|---|
| `apps/web/package.json` | Add `framer-motion` |
| `apps/web/src/app/globals.css` | Add CSS custom property tokens |
| `apps/web/src/app/[locale]/page.tsx` | Full rewrite — new landing page |
| `apps/web/src/app/[locale]/(auth)/layout.tsx` | Split-panel auth layout |
| `apps/web/src/app/[locale]/(auth)/login/page.tsx` | Rewrite form with new design |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Rewrite form with new design |
| `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` | Rewrite form |
| `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` | Rewrite form |
| `apps/web/src/app/[locale]/dashboard/layout.tsx` | Wrap content with `AnimatePresence` |
| `apps/web/src/components/dashboard/sidebar.tsx` | Full rewrite — icon sidebar with tooltips + layoutId |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Animated stat cards + calendar |
| `apps/web/src/components/dashboard/daily-calendar.tsx` | Stagger slot animations |
| `apps/web/src/components/dashboard/weekly-calendar.tsx` | Stagger slot animations |

---

## 10. RTL / Multilingual Compatibility

- All directional animations (x-slides, left panels) must respect `dir` attribute
- `x: -40` on LTR becomes `x: 40` on RTL — use `useDirection()` hook or conditionally flip
- Sidebar border changes from `border-r` to `border-l` in RTL
- Auth split panel flips sides in RTL

---

## 11. Accessibility

- All animations respect `prefers-reduced-motion`: wrap Framer Motion config with `useReducedMotion()` hook and disable transitions when true
- Sidebar icon-only nav: all icons have `aria-label` + Radix Tooltip
- Color contrast for all text on dark backgrounds: ≥ 4.5:1
- Focus rings visible on all interactive elements (`focus-visible:ring-2 ring-primary/50`)
