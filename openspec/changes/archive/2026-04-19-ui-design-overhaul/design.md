## Context

The web app uses raw Tailwind CSS with no component library. The `@queue/ui` package exists but only contains a single `Button` component with `class-variance-authority` (CVA), `clsx`, and `tailwind-merge` — the exact foundation shadcn/ui builds on. Every page hand-rolls its own inputs, cards, modals, and tables. Navigation uses emoji icons. The result looks functional but unpolished, especially for a paid SaaS product targeting Israeli service businesses.

The app has 4 main surfaces:
1. **Landing + Auth pages** — public-facing, first impression
2. **Booking flow** (`/b/[slug]`) — customer-facing, must feel trustworthy
3. **Dashboard** — business owner daily tool, must feel professional
4. **Admin panel** — internal, lower design priority but should be consistent

## Goals / Non-Goals

**Goals:**
- Establish shadcn/ui as the component library with Radix UI primitives
- Replace all emoji icons with Lucide React SVG icons
- Achieve a modern, polished look across all 4 surfaces
- Maintain full RTL support (Hebrew/Arabic) using logical CSS properties
- Keep the existing `@queue/ui` package as the shared component home

**Non-Goals:**
- Dark mode (can be added later via shadcn theming)
- Animation library (Framer Motion etc.) — keep it simple with CSS transitions
- Custom design tokens beyond what Tailwind + shadcn provide
- Mobile native app — responsive web only
- Changing any backend APIs or data flows

## Decisions

### 1. shadcn/ui as the component system

**Choice:** Use shadcn/ui (copy-paste component model) rather than a pre-built library like Ant Design, Chakra UI, or Material UI.

**Why:**
- shadcn/ui components are copied into the project, giving full ownership and customization
- Built on Radix UI primitives — best-in-class accessibility and RTL support
- Uses the CVA + clsx + tailwind-merge stack already in `@queue/ui`
- Tailwind-native — no CSS-in-JS runtime, works perfectly with the existing setup
- Rapidly growing ecosystem, well-documented, actively maintained

**Alternatives considered:**
- **Ant Design**: Excellent component set but heavy, opinionated styling, poor Tailwind integration, RTL is an afterthought
- **Chakra UI**: Good DX but CSS-in-JS runtime conflicts with Tailwind approach
- **Material UI**: Heavy bundle, Google's design language doesn't fit the brand

### 2. Component installation location

**Choice:** Install shadcn/ui components into `packages/ui/src/components/` and re-export from `@queue/ui`.

**Why:** Centralizes all UI components in the shared package. The web app already depends on `@queue/ui`. Other future apps (e.g., a separate admin app) can reuse the same components.

### 3. Lucide React for icons

**Choice:** Use `lucide-react` (the icon set shadcn/ui uses by default).

**Why:** Tree-shakeable, consistent style, 1400+ icons, perfect integration with shadcn/ui components. Each icon is ~1KB.

### 4. Color palette approach

**Choice:** Use shadcn/ui's CSS variable-based theming with a custom primary color (blue-600 as current brand).

**Why:** shadcn/ui's theming system uses CSS custom properties (`--primary`, `--secondary`, etc.) that work seamlessly with Tailwind. Easy to change brand color later.

### 5. Page-by-page migration strategy

**Choice:** Migrate one surface at a time: Auth → Landing → Booking → Dashboard → Admin. No incremental per-component migration.

**Why:** Each surface is relatively self-contained. Migrating a full surface ensures visual consistency within each area. Auth pages are simplest (fewest components), dashboard is most complex (calendars, modals, forms).

## Risks / Trade-offs

- **Bundle size increase** → Radix primitives add ~15-30KB gzipped. Acceptable for the UX improvement. Tree-shaking keeps it minimal.
- **Migration scope is large** → Every page template changes. Mitigated by keeping logic untouched — only JSX/styling changes.
- **shadcn/ui Tailwind v4 compatibility** → The project uses Tailwind v4. shadcn/ui recently added v4 support. If issues arise, pin to known-working component versions.
- **Calendar components** → shadcn/ui doesn't include a full calendar view. The daily/weekly calendar will remain custom but use shadcn primitives (Card, Badge, Dialog) for sub-elements.
