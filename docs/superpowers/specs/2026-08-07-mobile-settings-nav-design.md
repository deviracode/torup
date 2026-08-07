# Mobile Settings Nav — Design Spec

**Date:** 2026-08-07
**Status:** approved

## Overview

Settings (and Billing) are unreachable on mobile. The dashboard's mobile top bar in `apps/web/src/components/dashboard/sidebar.tsx` renders only the first 4 nav items (`navItems.slice(0, 4)` — Calendar, Customers, Services, Analytics) plus a Sign out icon. Billing and Settings have no entry point on small screens, despite the settings page itself being fully responsive.

## Problem

`apps/web/src/components/dashboard/sidebar.tsx:168` (mobile top bar):

```tsx
{navItems.slice(0, 4).map((item) => { ... })}
```

Items 5–6 (`billing`, `settings`) are never rendered on mobile. There is no overflow/More menu to reach them.

## Solution

Add a **More (⋯) menu** to the mobile top bar:

- Keep the 4 icon shortcuts (Calendar, Customers, Services, Analytics)
- Replace the standalone Sign out icon with a `MoreHorizontal` button
- The More button opens a dropdown (anchored with `top-full end-0` so it works in RTL) containing:
  - **Billing** (`/dashboard/billing`)
  - **Settings** (`/dashboard/settings`)
  - **Sign out** (moved from the icon row)
- The More button shows the active highlight when the current path is `/dashboard/billing` or `/dashboard/settings`
- Dropdown closes on outside click (same pattern as the existing business switcher: `mousedown` listener + ref) and after navigating

### Changes

All in **`apps/web/src/components/dashboard/sidebar.tsx`**:

1. Import `MoreHorizontal` from `lucide-react`
2. Add `moreOpen` state and `moreRef`; extend the existing `useEffect` click-outside handler to close it
3. In the mobile nav: render `navItems.slice(0, 4)` icons, then a `relative` wrapper with the More button and dropdown
4. Dropdown renders `navItems.slice(4)` (Billing, Settings) with the same button styling as the business switcher dropdown, then a divider and Sign out
5. Remove the standalone Sign out button from the icon row

### No API changes needed

The settings and billing pages are already responsive; only the navigation entry point is missing.

## Error Handling / Edge Cases

- **RTL:** dropdown uses logical property `end-0` so it aligns correctly in Hebrew/Arabic layouts
- **Narrow screens:** 5 items (4 icons + More) at `w-9` each fit on the smallest supported viewport, matching the previous 5-icon row width
- **Click-outside:** the More menu must close when tapping elsewhere, including on the business switcher (and vice versa)
