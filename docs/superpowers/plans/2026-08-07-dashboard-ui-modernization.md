# Dashboard UI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the torup dashboard's UI from Material-era components to first-class modern web components — new primitives in `@torup/ui`, a rebuilt settings area, and the new component language applied dashboard-wide — without changing the brand, backend, or data flow.

**Architecture:** Phase 1 builds the component foundation in `packages/ui` (upgrades + new primitives + tests). Phase 2 rebuilds the 1,079-line settings monolith into a thin shell + per-tab components using the new primitives. Phase 3 applies the foundation to the rest of the dashboard (sidebar, home, calendars, modals, remaining pages). Each task is independently type-checked and (where applicable) tested.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Radix primitives, class-variance-authority, framer-motion, lucide-react, sonner, react-hook-form + zod, react-day-picker, cmdk, vitest + @testing-library/react.

## Global Constraints

- **NO GIT COMMITS AT ANY POINT.** The user must approve before any commit. All work stays in the uncommitted working tree. The controller adapts review packages to `git diff` of the working tree.
- **Brand tokens are frozen.** Do not modify `--color-*`, `--radius-*`, or gradient variables in `apps/web/src/app/globals.css`. The dark indigo + amber identity stays.
- **Every interactive element comes from `@torup/ui`.** No raw `<select>`, `<input type="time">`, hand-rolled success banners, or inline-styled buttons anywhere in the dashboard after Phase 2/3.
- **RTL-safe:** use logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `gap` instead of `space-x`). Never hardcode `left`/`right` for directional layout.
- **i18n, Hebrew-first:** every new user-facing string goes into `packages/i18n/messages/he.json` first, then mirrored in `en.json` and `ar.json`. Follow existing key namespaces (`dashboard.*`, `common.*`, `nav.*`); extend with `dashboard.settings.*` sub-keys.
- **Data flow untouched:** API calls use `useApi()` from `@/lib/use-api` (returns `api<T>(path, options): Promise<T | null>`, already toasts errors) and `useBusiness()` from `@/components/auth/business-provider` (`{ businessId, hasNoBusiness, loading, businesses, switchBusiness }`). No backend changes.
- **Import style:** in `packages/ui`, relative imports use `.js` extensions (`./utils.js`). In `apps/web`, use the `@/` alias.
- **Dependency versions (match repo):** zod `^3.25.0`, vitest `^3.2.0`, framer-motion `^12.0.0` (already in web). Radix majors match existing packages (react-dialog ~1.1, react-select ~2.2).
- **Per-task gates:** `pnpm --filter @torup/ui type-check` (or web) must pass; new primitives have vitest component tests that pass; `pnpm --filter @torup/ui build` must pass before the web app can type-check against the new exports.
- **Do not restructure** unrelated code. Stay focused on the modernization scope (spec: docs/superpowers/specs/2026-08-07-dashboard-ui-modernization-design.md).

---

### Task 1: UI package dependencies + vitest test infrastructure

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/test/setup.ts`
- Create: `packages/ui/src/test/smoke.test.tsx`
- Modify: `packages/ui/tsconfig.json`

**Interfaces:**
- Produces: runnable `pnpm --filter @torup/ui test`; vitest globals configured; setup imports jest-dom matchers.

- [ ] **Step 1: Add dependencies**

In `packages/ui/package.json`, add to `dependencies`:
```json
"@radix-ui/react-switch": "^1.2.0",
"@radix-ui/react-checkbox": "^1.3.0",
"@radix-ui/react-radio-group": "^1.3.0",
"@radix-ui/react-popover": "^1.1.0",
"cmdk": "^1.1.0",
"framer-motion": "^12.0.0",
"react-day-picker": "^9.6.0"
```
Add to `devDependencies`:
```json
"@testing-library/jest-dom": "^6.0.0",
"@testing-library/react": "^16.0.0",
"@testing-library/user-event": "^14.0.0",
"@vitejs/plugin-react": "^4.0.0",
"jsdom": "^26.0.0",
"vitest": "^3.2.0"
```
Add to `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Create vitest config**

`packages/ui/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 3: Create test setup**

`packages/ui/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create smoke test (fails until component testable)**

`packages/ui/src/test/smoke.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Button } from "../button.js";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Update tsconfig for vitest globals**

In `packages/ui/tsconfig.json`, add to `compilerOptions`:
```json
"types": ["vitest/globals", "@testing-library/jest-dom"],
"jsx": "react-jsx"
```
(keep the existing `jsx: "react-jsx"` if already present).

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @torup/ui test`
Expected: 1 passing test.

- [ ] **Step 7: Type-check + install**

Run: `pnpm install` (to record lockfile) then `pnpm --filter @torup/ui type-check`
Expected: no errors.

### Task 2: Switch, Checkbox, RadioGroup primitives

**Files:**
- Create: `packages/ui/src/switch.tsx`
- Create: `packages/ui/src/checkbox.tsx`
- Create: `packages/ui/src/radio-group.tsx`
- Create: `packages/ui/src/switch.test.tsx`, `packages/ui/src/checkbox.test.tsx`, `packages/ui/src/radio-group.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces (all exported from `@torup/ui`):
  - `Switch: ({ checked, onCheckedChange, disabled?, className?, ...props })` — Radix switch, styled.
  - `Checkbox: ({ checked, onCheckedChange, disabled?, className?, ...props })` — Radix checkbox with Check icon.
  - `RadioGroup: ({ value, onValueChange, className?, ...props })` and `RadioGroupItem: ({ value, className?, ...props })` — Radix radio group, styled cards-friendly.
- Consumes: `cn` from `./utils.js`.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/switch.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch.js";

describe("Switch", () => {
  it("renders a switch role and reflects checked state", () => {
    render(<Switch checked />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });
  it("calls onCheckedChange on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```
`packages/ui/src/checkbox.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox.js";

describe("Checkbox", () => {
  it("renders a checkbox role and toggles", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```
`packages/ui/src/radio-group.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioGroupItem } from "./radio-group.js";

describe("RadioGroup", () => {
  it("selects a value on click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange}>
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>
    );
    await user.click(screen.getByRole("radio", { name: "" }).parentElement!);
    expect(onValueChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three components**

`packages/ui/src/switch.tsx`:
```tsx
import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "./utils.js";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-4"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;
```

`packages/ui/src/checkbox.tsx`:
```tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "./utils.js";

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
```

`packages/ui/src/radio-group.tsx`:
```tsx
import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "./utils.js";

export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;
```

- [ ] **Step 4: Export from index**

In `packages/ui/src/index.ts`, add:
```ts
export { Switch } from "./switch.js";
export { Checkbox } from "./checkbox.js";
export { RadioGroup, RadioGroupItem } from "./radio-group.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all tests PASS.

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors; dist emitted.

### Task 3: Spinner, Button loading state, Field wrapper, Input error styling

**Files:**
- Create: `packages/ui/src/spinner.tsx`
- Create: `packages/ui/src/field.tsx`
- Create: `packages/ui/src/field.test.tsx`
- Modify: `packages/ui/src/button.tsx` (add `loading` prop)
- Modify: `packages/ui/src/input.tsx` (aria-invalid styling support)
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `Spinner: ({ className?, size?: "sm" | "md" | "lg" })` — accessible (role="status", aria-label) rotating loader.
  - `Button` gains `loading?: boolean` — renders `Spinner` (size sm) before children, sets `disabled` and `aria-busy`.
  - `Field: ({ label?, hint?, error?, htmlFor?, required?, children, className? })` — composes Label + children + hint/error text; error renders in destructive color with `role="alert"` and `id` for `aria-describedby`.
  - `Input` supports error styling: when `aria-invalid` is true, border-destructive + focus ring destructive.
- Consumes: existing `Button`, `Input`, `Label`, `cn`.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/field.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Field } from "./field.js";
import { Input } from "./input.js";

describe("Field", () => {
  it("renders label, control, and error", () => {
    render(
      <Field label="Name" htmlFor="name" error="Required">
        <Input id="name" />
      </Field>
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
  it("renders hint when no error", () => {
    render(
      <Field label="Name" htmlFor="name" hint="Shown publicly">
        <Input id="name" />
      </Field>
    );
    expect(screen.getByText("Shown publicly")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — `Field` not exported.

- [ ] **Step 3: Implement**

`packages/ui/src/spinner.tsx`:
```tsx
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./utils.js";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = "md", ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2
        className={cn(
          "animate-spin",
          size === "sm" && "h-4 w-4",
          size === "md" && "h-5 w-5",
          size === "lg" && "h-7 w-7"
        )}
      />
    </span>
  )
);
Spinner.displayName = "Spinner";
```

`packages/ui/src/field.tsx`:
```tsx
import * as React from "react";
import { Label } from "./label.js";
import { cn } from "./utils.js";

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

const errorId = (htmlFor: string | undefined, suffix: string) =>
  htmlFor ? `${htmlFor}-${suffix}` : undefined;

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const describedBy = error
    ? errorId(htmlFor, "error")
    : hint
      ? errorId(htmlFor, "hint")
      : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="ms-1 text-destructive">*</span>}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
            ...(error ? { "aria-invalid": true } : {}),
          })
        : children}
      {error ? (
        <p id={errorId(htmlFor, "error")} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={errorId(htmlFor, "hint")} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
```

`packages/ui/src/button.tsx` — replace the component body:
```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "./spinner.js";
import { cn } from "./utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" className="me-2" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { buttonVariants };
```

`packages/ui/src/input.tsx` — change the className template:
```tsx
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-start ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
```

- [ ] **Step 4: Export from index**

Add to `packages/ui/src/index.ts`:
```ts
export { Spinner } from "./spinner.js";
export type { SpinnerProps } from "./spinner.js";
export { Field } from "./field.js";
export type { FieldProps } from "./field.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all PASS.

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

### Task 4: Badge variant system + EmptyState

**Files:**
- Create: `packages/ui/src/badge-variants.ts` (or rewrite `badge.tsx`)
- Rewrite: `packages/ui/src/badge.tsx` — full variant set with dot support
- Create: `packages/ui/src/empty-state.tsx`
- Create: `packages/ui/src/badge.test.tsx`, `packages/ui/src/empty-state.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `Badge: ({ variant?: "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "outline", dot?: boolean, className?, ...props })` — dot renders a small colored dot before children.
  - `EmptyState: ({ icon?: LucideIcon, title: string, description?: string, action?: ReactNode, className? })` — centered icon in muted circle, title, description, optional action.
- Consumes: `cn`, `cva`, lucide `type LucideIcon`.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/badge.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge.js";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Connected</Badge>);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
  it("renders a dot when dot is true", () => {
    render(<Badge dot>Live</Badge>);
    const dot = screen.getByText("Live").previousElementSibling;
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain("rounded-full");
  });
});
```
`packages/ui/src/empty-state.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state.js";
import { Users } from "lucide-react";

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    render(<EmptyState icon={Users} title="No staff" description="Add your first team member" action={<button>Add</button>} />);
    expect(screen.getByText("No staff")).toBeInTheDocument();
    expect(screen.getByText("Add your first team member")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL for the new tests.

- [ ] **Step 3: Implement**

`packages/ui/src/badge.tsx`:
```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const dotColor: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  success: "bg-success-foreground",
  warning: "bg-warning-foreground",
  info: "bg-foreground",
  destructive: "bg-destructive-foreground",
  outline: "bg-foreground",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant ?? "default"])} />}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export { badgeVariants };
export type { VariantProps };
```

`packages/ui/src/empty-state.tsx`:
```tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils.js";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Export from index**

Replace existing Badge export line with:
```ts
export { Badge, badgeVariants } from "./badge.js";
export type { BadgeProps } from "./badge.js";
export { EmptyState } from "./empty-state.js";
export type { EmptyStateProps } from "./empty-state.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all PASS.

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

### Task 5: Calendar + DatePicker

**Files:**
- Create: `packages/ui/src/calendar.tsx`
- Create: `packages/ui/src/date-picker.tsx`
- Create: `packages/ui/src/date-picker.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `Calendar: ({ className, classNames, showOutsideDays?, ...props })` — react-day-picker v9 wrapper, styled with theme tokens, RTL-safe (use `gap` not `space-x`; `start-`/`end-` logical positions for nav buttons).
  - `DatePicker: ({ value?: Date, onChange: (d: Date | undefined) => void, placeholder?: string, className?, disabled?, align? })` — Popover + Calendar; trigger is a Button (outline) showing formatted date or placeholder; clear button when value set; opens calendar; selects and closes.
- Consumes: `buttonVariants`, `cn`, Radix popover, lucide `CalendarIcon`/`X` icons.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/date-picker.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker.js";

describe("DatePicker", () => {
  it("renders placeholder when no value", () => {
    render(<DatePicker value={undefined} onChange={() => {}} placeholder="Pick a date" />);
    expect(screen.getByRole("button", { name: /pick a date/i })).toBeInTheDocument();
  });
  it("selects a date from the calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value={undefined} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    // click today's date cell
    const today = new Date().getDate().toString();
    await user.click(screen.getByRole("gridcell", { name: today }));
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`packages/ui/src/calendar.tsx`:
```tsx
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "./utils.js";
import { buttonVariants } from "./button.js";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute start-1",
        nav_button_next: "absolute end-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex w-full",
        head_cell: "w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        row: "flex w-full mt-2",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent/40",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent/40 text-accent-foreground",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
```

`packages/ui/src/date-picker.tsx`:
```tsx
import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "./date-format.js";
import { Button } from "./button.js";
import { Calendar } from "./calendar.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { cn } from "./utils.js";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  fromYear?: number;
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  align = "start",
  fromYear = new Date().getFullYear() - 5,
  toYear = new Date().getFullYear() + 2,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 opacity-60" />
          {value ? format(value) : placeholder}
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="ms-auto text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          fromYear={fromYear}
          toYear={toYear}
        />
      </PopoverContent>
    </Popover>
  );
}
```

Note: the plan uses `./date-format.js` — create it:
`packages/ui/src/date-format.ts`:
```ts
import { getDirection } from "@torup/i18n";
```
> **Controller note:** `@torup/ui` must not depend on `@torup/i18n` at runtime for a formatter. Instead, implement a local `format(date: Date): string` in `packages/ui/src/date-format.ts` that renders `DD/MM/YYYY` (repo convention: Hebrew UI uses day-first dates; e.g., `17/07/2026`). Keep it locale-agnostic for now; the web app can override formatting where needed.

`packages/ui/src/date-format.ts` (final):
```ts
export function format(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
```

Add popover to index exports if not present (from Task 1 deps):
```ts
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./popover.js";
```
Create `packages/ui/src/popover.tsx` (shadcn standard — Radix popover with animated content):
```tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "./utils.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
```
(The `animate-in` utilities come from `tw-animate-css` which is already a web dependency — add `tw-animate-css` to `packages/ui` devDependencies if the utilities are unresolved; Tailwind v4 resolves classes at build time in each package's own CSS context. The web app compiles `@torup/ui` class names through its own build, so `tw-animate-css` being present in apps/web is sufficient.)

- [ ] **Step 4: Export from index**

Add:
```ts
export { Calendar } from "./calendar.js";
export type { CalendarProps } from "./calendar.js";
export { DatePicker } from "./date-picker.js";
export type { DatePickerProps } from "./date-picker.js";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./popover.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all PASS.

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

### Task 6: TimePicker + SegmentedControl

**Files:**
- Create: `packages/ui/src/time-picker.tsx`
- Create: `packages/ui/src/segmented-control.tsx`
- Create: `packages/ui/src/time-picker.test.tsx`, `packages/ui/src/segmented-control.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `TimePicker: ({ value: string, onChange: (v: string) => void, minuteStep?: number, className?, disabled?, hourPlaceholder?, minutePlaceholder? })` — two compact Selects side by side (hour `00`–`23`, minute in `minuteStep` increments, default 5); value format `"HH:mm"` (24h). RTL-safe (flex + gap).
  - `SegmentedControl: ({ options: Array<{ value: string; label: ReactNode }>, value: string, onChange: (v: string) => void, className?, disabled? })` — pill container with framer-motion `layoutId` active indicator; keyboard accessible via buttons + roving tabIndex.
- Consumes: `Select` family from `./select.js`, `cn`, framer-motion.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/time-picker.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimePicker } from "./time-picker.js";

describe("TimePicker", () => {
  it("renders hour and minute selects with current value", () => {
    render(<TimePicker value="09:30" onChange={() => {}} />);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
  });
});
```
`packages/ui/src/segmented-control.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control.js";

describe("SegmentedControl", () => {
  it("calls onChange with the clicked option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
        value="open"
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Closed" }));
    expect(onChange).toHaveBeenCalledWith("closed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`packages/ui/src/time-picker.tsx`:
```tsx
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { cn } from "./utils.js";

export interface TimePickerProps {
  value: string; // "HH:mm", 24h
  onChange: (value: string) => void;
  minuteStep?: number;
  className?: string;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const DEFAULT_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimePicker({ value, onChange, minuteStep = 5, className, disabled }: TimePickerProps) {
  const [hour, minute] = (value ?? "09:00").split(":");
  const minutes =
    minuteStep === 5 ? DEFAULT_MINUTES : Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, "0"));

  const setHour = (h: string) => onChange(`${h}:${minute}`);
  const setMinute = (m: string) => onChange(`${hour}:${m}`);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={hour} onValueChange={setHour} disabled={disabled}>
        <SelectTrigger className="w-20" aria-label="Hour">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground" aria-hidden>
        :
      </span>
      <Select value={minutes.includes(minute) ? minute : undefined} onValueChange={setMinute} disabled={disabled}>
        <SelectTrigger className="w-20" aria-label="Minute">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

`packages/ui/src/segmented-control.tsx`:
```tsx
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "./utils.js";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SegmentedControl({ options, value, onChange, className, disabled }: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-foreground" : "hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="segmented-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Export from index**

Add:
```ts
export { TimePicker } from "./time-picker.js";
export type { TimePickerProps } from "./time-picker.js";
export { SegmentedControl } from "./segmented-control.js";
export type { SegmentedControlProps, SegmentedOption } from "./segmented-control.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all PASS.

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

### Task 7: Tabs upgrade (animated, scrollable, icons) + Combobox

**Files:**
- Rewrite: `packages/ui/src/tabs.tsx` — animated active indicator, scrollable list, icon support
- Create: `packages/ui/src/command.tsx` (cmdk wrappers)
- Create: `packages/ui/src/combobox.tsx`
- Create: `packages/ui/src/combobox.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — same API as before (Radix) but: TabsList scrollable (`overflow-x-auto` + `no-scrollbar`), TabsTrigger has animated active indicator (framer-motion `layoutId="tabs-indicator"`), accepts arbitrary children (icons + label). Keep existing data attributes for tests.
  - `Combobox: ({ options: Array<{ value: string; label: string }>, value?: string, onChange: (v: string | undefined) => void, placeholder?, searchPlaceholder?, emptyText?, className?, disabled? })` — Button trigger showing selected label or placeholder; Popover with Command; search filters options; keyboard navigable; selecting calls onChange and closes.
- Consumes: `cn`, Radix Tabs, framer-motion, cmdk, `Popover` from `./popover.js`, lucide icons (Check, ChevronsUpDown, Search).

- [ ] **Step 1: Write the failing test**

`packages/ui/src/combobox.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./combobox.js";

describe("Combobox", () => {
  it("shows placeholder when no selection", () => {
    render(<Combobox options={[{ value: "a", label: "Alpha" }]} value={undefined} onChange={() => {}} placeholder="Select..." />);
    expect(screen.getByRole("button", { name: /select\.\.\./i })).toBeInTheDocument();
  });
  it("selects an option and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        value={undefined}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("option", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — Combobox not found.

- [ ] **Step 3: Implement**

`packages/ui/src/tabs.tsx` (full rewrite):
```tsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "./utils.js";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className
      )}
      {...props}
    >
      <React.Fragment>
        <TabsPrimitive.Trigger
          className="sr-only"
          data-state={props["data-state"]}
        />
        {props["data-state"] === "active" && (
          <motion.span
            layoutId="tabs-active-indicator"
            className="absolute inset-0 rounded-md bg-background shadow-sm"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">{props.children}</span>
      </React.Fragment>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
```
> **Controller note:** the nested `TabsPrimitive.Trigger` with `sr-only` inside the trigger is WRONG (renders nested buttons). Instead, read `data-state` from the props the Radix trigger receives: Radix passes `data-state` to the trigger element automatically. Implement the indicator with a separate motion.span keyed by an `isActive` derived from `props["data-state"]`, rendered as a sibling overlay inside the same trigger button — but DO NOT nest another Trigger. Correct implementation pattern:

```tsx
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
      className
    )}
    {...props}
  >
    {props["data-state"] === "active" && (
      <motion.span
        layoutId="tabs-active-indicator"
        className="absolute inset-0 rounded-md bg-background shadow-sm"
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
      />
    )}
    <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
  </TabsPrimitive.Trigger>
));
```
(`data-state` is present in props passed through Radix — if it isn't visible at render time via `props["data-state"]`, use `useContext` or read `document.querySelector` — the implementer should verify; the standard shadcn animated-tabs variant uses `layoutId` with a `TabsTrigger` rendering a `motion.span` when active, using the `data-state` attribute selector via CSS. Fallback: drive the indicator with CSS `data-[state=active]` styles plus framer-motion `layout` on a span that is always rendered but styled via group-data. The review loop validates behavior in tests: active trigger shows indicator.)

`packages/ui/src/command.tsx` (shadcn standard, cmdk):
```tsx
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "./utils.js";

export const Command = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

export const CommandInput = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="me-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn("flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn("overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandItem = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandSeparator = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;
```

`packages/ui/src/combobox.tsx`:
```tsx
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "./button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command.js";
import { cn } from "./utils.js";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  className,
  disabled,
  align = "start",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align={align}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? undefined : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("me-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Export from index**

Add:
```ts
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs.js";
export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "./command.js";
export { Combobox } from "./combobox.js";
export type { ComboboxProps, ComboboxOption } from "./combobox.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @torup/ui test`
Expected: all PASS (existing Tabs consumers still type-check — Radix API unchanged).

- [ ] **Step 6: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

### Task 8: FormSection / SettingRow, Toaster, motion helpers

**Files:**
- Create: `packages/ui/src/form-section.tsx`
- Create: `packages/ui/src/toaster.tsx`
- Create: `packages/ui/src/motion.tsx`
- Create: `packages/ui/src/form-section.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `FormSection: ({ title, description?, children, className? })` — section wrapper: header (title + optional description) + content, with `border-b` dividers between siblings.
  - `SettingRow: ({ title, description?, children, htmlFor?, className? })` — responsive row: label block (title + description) on one side, control on the other (`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`).
  - `Toaster: ()` — renders `<Toaster richColors position="top-center" closeButton />` from sonner (re-export).
  - Motion helpers in `motion.tsx`:
    - `FadeIn: ({ children, delay?, className?, as? })` — motion.div fade+slight rise on mount.
    - `StaggerGroup: ({ children, className?, stagger? })` — motion.div with staggerChildren container.
    - `StaggerItem: ({ children, className? })` — motion.div with fade-in-up variant.
    - `Pressable: ({ children, className?, ...buttonProps })` — motion.button with `whileTap={{ scale: 0.98 }}`.
  - All motion respects `prefers-reduced-motion` (framer-motion `useReducedMotion` guard or CSS).
- Consumes: `cn`, sonner, framer-motion.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/form-section.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { FormSection, SettingRow } from "./form-section.js";
import { Switch } from "./switch.js";

describe("FormSection / SettingRow", () => {
  it("renders section title and description", () => {
    render(<FormSection title="Notifications" description="Choose what to send">content</FormSection>);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Choose what to send")).toBeInTheDocument();
  });
  it("renders a labeled setting row with a control", () => {
    render(
      <SettingRow title="Reminders" description="Send before the appointment">
        <Switch checked />
      </SettingRow>
    );
    expect(screen.getByText("Reminders")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @torup/ui test`
Expected: FAIL — FormSection not found.

- [ ] **Step 3: Implement**

`packages/ui/src/form-section.tsx`:
```tsx
import * as React from "react";
import { cn } from "./utils.js";

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("border-b border-border pb-6 last:border-b-0", className)}>
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function SettingRow({ title, description, children, htmlFor, className }: SettingRowProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
```

`packages/ui/src/toaster.tsx`:
```tsx
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return <Sonner richColors position="top-center" closeButton />;
}
```

`packages/ui/src/motion.tsx`:
```tsx
import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "./utils.js";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
}

export function FadeIn({ children, delay = 0, y = 8, className, ...props }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerGroupProps extends HTMLMotionProps<"div"> {
  stagger?: number;
}

export function StaggerGroup({ children, stagger = 0.05, className, ...props }: StaggerGroupProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface PressableProps extends HTMLMotionProps<"button"> {}

export function Pressable({ children, className, ...props }: PressableProps) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }} className={cn("cursor-pointer", className)} {...props}>
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 4: Export from index**

Add:
```ts
export { FormSection, SettingRow } from "./form-section.js";
export type { FormSectionProps, SettingRowProps } from "./form-section.js";
export { Toaster } from "./toaster.js";
export { FadeIn, StaggerGroup, StaggerItem, Pressable } from "./motion.js";
export type { FadeInProps, StaggerGroupProps, PressableProps } from "./motion.js";
```

- [ ] **Step 5: Add sonner dep to ui package**

Add `"sonner": "^2.0.0"` to `packages/ui/package.json` dependencies (currently only in web).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm install && pnpm --filter @torup/ui test`
Expected: all PASS.

- [ ] **Step 7: Type-check + build**

Run: `pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build`
Expected: no errors.

---

**Phase 2 — Settings rebuild** (tasks 9–15). All tasks read the existing `apps/web/src/app/[locale]/dashboard/settings/page.tsx` (1,079 lines) for the data logic and preserve it exactly; they only change markup/structure. Existing fetch patterns: `useApi()` + `useBusiness()`, `fetchTab` per-tab, local state + explicit save buttons. Preserve all endpoint paths and payload shapes verbatim.

### Task 9: Settings shell split — thin page + per-tab components + animated tab nav

**Files:**
- Create: `apps/web/src/components/dashboard/settings/settings-tabs.tsx` — animated, scrollable tab nav with icons + labels.
- Create: `apps/web/src/components/dashboard/settings/settings-page.tsx` — the shell (tab state, per-tab render).
- Rewrite: `apps/web/src/app/[locale]/dashboard/settings/page.tsx` — thin: renders `<SettingsPage />` (keep `Suspense` + `useSearchParams` gcal redirect handling).
- Create (extracted verbatim from the existing page's JSX, logic preserved): `working-hours-tab.tsx`, `breaks-tab.tsx`, `reminders-tab.tsx`, `booking-rules-tab.tsx`, `staff-tab.tsx`, `profile-tab.tsx`, `booking-tab.tsx`, `gcal-tab.tsx`, `services-tab.tsx`, `whatsapp-tab.tsx` in `apps/web/src/components/dashboard/settings/`.
- Modify: `packages/i18n/messages/he.json`, `en.json`, `ar.json` — tab labels/descriptions keys if missing (reuse existing keys: `dashboard.workingHours`, `dashboard.breaks`, `dashboard.reminders`, `dashboard.bookingRules`, `dashboard.staffManagement`, `dashboard.businessProfile`, `dashboard.booking`, `dashboard.services`, `dashboard.whatsapp`, `nav.settings`; add `dashboard.settings.gcal` = "Google Calendar").

**Interfaces:**
- Produces:
  - `SettingsTabs: ({ active: Tab, onChange: (t: Tab) => void, tabs: Array<{ key: Tab; label: string; icon: LucideIcon }> })` — uses upgraded `Tabs` primitives (`TabsList` scrollable, `TabsTrigger` with icon + label, animated indicator).
  - `Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking" | "gcal" | "services" | "whatsapp"` (exported from `settings-tabs.tsx`).
  - Each tab component: named export, fetches its own data on mount, renders its section; shell holds `message`/`saving` per tab OR each tab manages its own save state (preferred: each tab owns save + toast via sonner).
- Consumes: new primitives from `@torup/ui` (Tabs, Badge, Button, Skeleton, EmptyState, Spinner, Toaster), existing `useApi`, `useBusiness`, `next-intl`.

- [ ] **Step 1: Read the existing settings page**

Read `apps/web/src/app/[locale]/dashboard/settings/page.tsx` fully. Inventory: tab type, per-tab state, fetch functions, save functions, JSX blocks for each of the 10 tabs.

- [ ] **Step 2: Create the shell + tabs nav**

`settings-tabs.tsx`:
```tsx
"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@torup/ui";
import type { LucideIcon } from "lucide-react";

export type Tab =
  | "hours" | "breaks" | "reminders" | "rules" | "staff"
  | "profile" | "booking" | "gcal" | "services" | "whatsapp";

export interface TabDef {
  key: Tab;
  label: string;
  icon: LucideIcon;
}

export function SettingsTabs({ tabs, active, onChange }: { tabs: TabDef[]; active: Tab; onChange: (t: Tab) => void }) {
  return (
    <Tabs value={active} onValueChange={(v) => onChange(v as Tab)} className="w-full">
      <TabsList className="w-full justify-start">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

`settings-page.tsx` (shell): holds `const [tab, setTab] = useState<Tab>("hours")`; renders `<SettingsTabs />` + the active tab component. Uses `FadeIn`/`AnimatePresence` for tab-switch transition. Render a `Toaster` at dashboard root (put it once in `apps/web/src/app/[locale]/dashboard/layout.tsx` if one doesn't exist yet — check; else render in shell).

- [ ] **Step 3: Extract each tab verbatim**

For each of the 10 tabs: move the JSX + its state/handlers into `settings/<tab>-tab.tsx` as a `"use client"` component. Preserve fetch endpoints, payloads, and logic exactly. The old `fetchTab` switch is deleted; each tab fetches on mount via its own `useEffect`. The old `message` banner is replaced with sonner `toast.success/error` calls at each save (keep the message text as the toast content — temporarily, until per-tab i18n keys land in tasks 10–15).

`page.tsx` becomes:
```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsPage } from "@/components/dashboard/settings/settings-page";

function SettingsRoute() {
  const params = useSearchParams();
  const code = params.get("code");
  // keep the existing gcal OAuth redirect logic: if code present, initial tab = "gcal"
  return <SettingsPage initialTab={code ? "gcal" : undefined} />;
}

export default function Settings() {
  return (
    <Suspense fallback={null}>
      <SettingsRoute />
    </Suspense>
  );
}
```

- [ ] **Step 4: Add tab icons**

Icons per tab from lucide-react: hours → `Clock`, breaks → `Coffee`, reminders → `Bell`, rules → `ShieldCheck`, staff → `Users`, profile → `Building2`, booking → `CalendarCheck`, gcal → `Calendar`, services → `Scissors`, whatsapp → `MessageCircle`. (Verify each icon name exists in lucide-react v1.8 — if an import fails, pick the closest available.)

- [ ] **Step 5: Verify behavior preserved**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.
Manual check (dev server optional): tabs switch correctly, gcal `code` param still routes to gcal tab, each tab fetches on mount.

### Task 10: Working hours + Breaks tabs modernization

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/working-hours-tab.tsx`
- Modify: `apps/web/src/components/dashboard/settings/breaks-tab.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Switch`, `TimePicker`, `Badge`, `Button`, `Dialog` (delete confirm), `SegmentedControl`, `Field`, `FormSection`/`SettingRow`, `Skeleton`, `EmptyState`, sonner `toast`, `Spinner`.
- Produces: modernized hours/breaks tabs with identical data behavior.

- [ ] **Step 1: Working hours**

Replace raw checkboxes with `Switch` (closed days), raw `time` inputs with `TimePicker`, day label + closed switch + TimePicker pairs in `SettingRow`s grouped in a `FormSection`. Save button: `loading={saving}`. Replace any success banner with `toast.success(...)`. Loading state: `Skeleton` rows while fetching.

- [ ] **Step 2: Breaks**

List items → cards with `Badge` (recurring vs one-time) and a delete `Button` variant="ghost" destructive that opens a `Dialog` confirm. Add-form → `RadioGroup` (recurring/one_time) or `SegmentedControl`, day `Select`, `TimePicker`, label `Input` in a `Field`. Empty state → `EmptyState`. Save feedback via toast.

- [ ] **Step 3: i18n keys**

Add under `dashboard.settings.hours.*` and `dashboard.settings.breaks.*` (he first, then en, ar): any new labels beyond the existing keys (e.g., `confirmDelete`, `deleteBreakTitle`, `closedDay`, `recurring`, `oneTime` reuse existing `dashboard.recurring`/`dashboard.oneTime` if present).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors. Rebuild ui if needed (`pnpm --filter @torup/ui build`).

### Task 11: Reminders + Booking rules tabs modernization

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/reminders-tab.tsx`
- Modify: `apps/web/src/components/dashboard/settings/booking-rules-tab.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Switch`, `Badge`, `Button`, `Field`, `FormSection`/`SettingRow`, `Skeleton`, toast, `Spinner`.

- [ ] **Step 1: Reminders**

Preset chips (15min→48h): render as toggleable buttons (selected = `Badge`-style or chip with primary bg) inside a `StaggerGroup`; each row wrapped in `SettingRow` with a `Switch` for `is_active`. Add reminder → small inline add row with `TimePicker`-independent preset `Select` or chip select. Save via button with `loading`, feedback via toast.

- [ ] **Step 2: Booking rules**

Group fields into `FormSection`s: "Advance booking" (min advance), "Booking window" (max future days), "Cancellation" (cancellation window), "Reschedule" (reschedule window). Numeric `Input` in `Field` (type="number"), or `SegmentedControl` where a small preset list fits. Save with `loading` + toast.

- [ ] **Step 3: i18n keys**

Add `dashboard.settings.reminders.*` and `dashboard.settings.rules.*` keys (he/en/ar).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 12: Profile + Booking tabs modernization

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/profile-tab.tsx`
- Modify: `apps/web/src/components/dashboard/settings/booking-tab.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Field`, `Input`, `Button`, `FormSection`, `Skeleton`, toast, `Spinner`.

- [ ] **Step 1: Profile**

Group into `FormSection`s: Business identity (name, slug, description), Contact (phone, email), Address, WhatsApp bot context. The ui package has NO textarea primitive — add `Textarea` to `packages/ui` (shadcn standard `textarea.tsx`, styled consistently with Input; export it; add a trivial test: renders and passes className). Use it for the bot context field. Save per section with `loading` + toast. Preserve slug formatting rules (read existing page for the slug transform).

- [ ] **Step 2: Booking**

Group toggles/fields into logical `FormSection`s; `Switch` for booleans, `Field`+`Input` for numbers (min/max party size etc. — read existing fields). Save with `loading` + toast.

- [ ] **Step 3: Textarea primitive**

If added: `packages/ui/src/textarea.tsx` + export + test (render + className passthrough).

- [ ] **Step 4: i18n keys**

Add `dashboard.settings.profile.*` and `dashboard.settings.booking.*` keys.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @torup/ui test` (if textarea added) and `pnpm --filter @torup/web type-check`
Expected: all pass.

### Task 13: Staff tab — restyled staff card + add/edit dialog with validation

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/staff-tab.tsx`
- Modify: `apps/web/src/components/dashboard/staff-card.tsx` (restyle to new primitives)
- Modify: `apps/web/src/components/dashboard/settings/staff-member-dialog.tsx` (new — add/edit member form)
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Dialog`, `Field`, `Input`, `Button`, `Select`/`Combobox` (service assignment if present in existing form — read existing), `Badge` (role), `EmptyState`, `Skeleton`, toast, `StaggerGroup`/`StaggerItem` for the staff list.
- Produces: staff CRUD preserved with validated form (name required; phone optional, validated if present; keep the exact API payloads from the existing page).

- [ ] **Step 1: Read existing staff logic**

Read the staff section of `settings/page.tsx` (existing `staff-tab.tsx` from Task 9) and `staff-card.tsx`. Note the exact endpoints (`/api/businesses/:id/staff`, etc.) and payloads.

- [ ] **Step 2: Build the dialog form**

`staff-member-dialog.tsx`: `Dialog` with a `Field`-based form (name, role select, phone, email if present). Use `react-hook-form` + `zod`:
- Add `react-hook-form` + `zod` + `@hookform/resolvers` to `apps/web/package.json` dependencies (zod `^3.25.0`, resolvers `^3.10.0`, rhf `^7.0.0`).
- Schema: `{ name: z.string().min(1, ...), phone: z.string().optional(), ... }` (match existing fields).
- On submit: call the same endpoint with the same payload shape; `toast.success`/`toast.error`; close dialog on success.

- [ ] **Step 3: Restyle StaffCard**

Use `Card`, `Avatar`, `Badge` (role), icon buttons (edit/delete with `Button variant="ghost" size="icon"` + lucide icons), `StaggerItem` wrap. Preserve the existing edit/delete callbacks.

- [ ] **Step 4: Wire the tab**

Replace inline add/edit forms with the dialog; add `EmptyState` when no staff; skeleton while loading.

- [ ] **Step 5: i18n keys**

Add `dashboard.settings.staff.*` keys (addMember, editMember, memberName, memberPhone, role, etc.).

- [ ] **Step 6: Verify**

Run: `pnpm install` (new deps) then `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 14: Services tab — modern list + add/edit dialog

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/services-tab.tsx`
- Modify: `apps/web/src/components/dashboard/settings/service-dialog.tsx` (new)
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Card`, `Badge` (price type), `Button`, `Dialog`, `Field`, `Input`, `Select`, `Skeleton`, `EmptyState`, toast, `StaggerGroup`/`StaggerItem`.
- Produces: services CRUD preserved; category grouping preserved (read existing); sort order controls preserved (up/down buttons restyled with icons).

- [ ] **Step 1: Read existing services logic**

Extract from the existing services tab: endpoints, payloads (name_he/name_ar/name_en, duration_minutes, price, price_type, category_id, sort_order), category handling.

- [ ] **Step 2: Build service dialog**

`service-dialog.tsx`: form with name fields (he required; ar/en optional), duration (minutes `Field`+`Input` or `TimePicker`-style), price (`Field`+`Input`), price type (`Select`: fixed/variable — read existing), category (`Select` of categories). RHF + zod validation (name_he required, duration > 0). Preserve payload.

- [ ] **Step 3: Restyle the list**

Grouped by category; each service row: name (he + en/ar if present), duration + price with `Badge`, edit/delete icon buttons, up/down sort buttons. `EmptyState` when no services. Skeleton while loading.

- [ ] **Step 4: i18n keys**

Add `dashboard.settings.services.*` keys (addService, editService, durationMinutes, price, priceType, category, etc.).

- [ ] **Step 5: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 15: gcal + whatsapp tabs + settings final sweep

**Files:**
- Modify: `apps/web/src/components/dashboard/settings/gcal-tab.tsx`
- Modify: `apps/web/src/components/dashboard/settings/whatsapp-tab.tsx` (wraps restyled `WhatsAppSettings`)
- Modify: `apps/web/src/components/dashboard/whatsapp-settings.tsx` (restyle to primitives)
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Badge` (connected/not connected), `Button`, `Switch` (sync/push toggles), `Skeleton`, toast, `FormSection`/`SettingRow`.

- [ ] **Step 1: gcal tab**

Status → `Badge dot` (success when connected, muted when not) with last-sync info; connect/disconnect `Button`s; sync + push `Switch`es in `SettingRow`s; skeleton while loading; keep the OAuth redirect URL construction and endpoint payloads exactly.

- [ ] **Step 2: whatsapp settings restyle**

`whatsapp-settings.tsx`: replace raw inputs with `Field`+`Input` (password-type fields with show/hide keep existing behavior), connection status `Badge`, webhook URL row with copy `Button` (already uses sonner toast — keep), test-message row with `Input` + `Button loading`. Keep ALL endpoints and payloads.

- [ ] **Step 3: Final settings sweep**

- Grep the whole `settings/` dir for raw `<select>`, `<input type="time"`, `bg-green-50`, `border-border px-2 py-1` (raw inputs) — eliminate all.
- Confirm every user-facing string is in i18n (he/en/ar) — no hardcoded Hebrew/English strings in JSX.
- Run: `pnpm --filter @torup/ui test && pnpm --filter @torup/ui build && pnpm --filter @torup/web type-check`
- Expected: all pass.

---

**Phase 3 — Dashboard-wide** (tasks 16–22). Same rules: preserve all data logic and endpoints; only markup/UX changes; i18n for new strings.

### Task 16: Sidebar + top bar modernization

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`
- Modify: `apps/web/src/components/dashboard/top-bar-slot.tsx` / `top-bar-context.tsx` (if styling needed)
- Modify: `apps/web/src/components/dashboard/sidebar-mobile.tsx` (new, if sidebar lacks a mobile drawer)
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Tooltip`, `Sheet`, `Button`, `Badge`, lucide icons, `motion` helpers.

- [ ] **Step 1: Read sidebar**

Read `sidebar.tsx` (195 lines). Modernize: active item with animated indicator (framer-motion `layoutId="sidebar-active"`), consistent icon sizing, `Tooltip` on icon-only collapsed mode (if collapse exists), hover states, mobile `Sheet` drawer with the same nav. Keep all links and the business switcher behavior.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 17: Home page — stat cards, pending approvals, skeletons

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Modify: `apps/web/src/components/dashboard/pending-approvals-panel.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Card`, `Skeleton`, `Badge`, `Button`, `EmptyState`, `StaggerGroup`/`StaggerItem`, `FadeIn`.

- [ ] **Step 1: Stat cards**

Modernize the stat cards (appointments today, revenue, etc. — read existing): consistent `Card` + icon + value + delta styling, hover lift (`Pressable` or hover translate via motion), skeleton loading while data loads. Preserve data fetching.

- [ ] **Step 2: Pending approvals**

Restyle `pending-approvals-panel.tsx`: item cards with `Badge` (pending status), approve/decline `Button`s with loading states, `EmptyState` when none, `StaggerItem` entrance. Preserve endpoints/payloads.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 18: Appointment modal + new appointment form — validated forms

**Files:**
- Modify: `apps/web/src/components/dashboard/appointment-modal.tsx`
- Modify: `apps/web/src/components/dashboard/new-appointment-form.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Dialog`, `Field`, `Input`, `Select`/`Combobox` (customer, staff, service), `DatePicker`, `TimePicker`, `Button loading`, toast, RHF + zod.

- [ ] **Step 1: Read both files**

Read `appointment-modal.tsx` (531) and `new-appointment-form.tsx` (375). Inventory the fields: customer select, staff select, service select, date, time, duration, notes, etc. Preserve all endpoints/payloads.

- [ ] **Step 2: Add RHF + zod validation**

`apps/web` already gets react-hook-form + zod from Task 13. Build a `zod` schema for the appointment form (required: customer/staff/service/date/time; notes optional; duration > 0). Wire `Field` + error rendering. Keep optimistic/loading behavior: submit button `loading`, `toast.success` on create/update, dialog closes on success.

- [ ] **Step 3: Modernize selects + pickers**

Replace raw selects with `Select`/`Combobox` (customer list is long → `Combobox` with search), date with `DatePicker`, time with `TimePicker`. Keep the existing data loading (customers/staff/services lists).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 19: Calendar chrome pass (daily/weekly/month-year-picker)

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`
- Modify: `apps/web/src/components/dashboard/weekly-calendar.tsx`
- Modify: `apps/web/src/components/dashboard/month-year-picker.tsx`

**Interfaces:**
- Consumes: `Button`, `Tooltip`, `Badge`, `Select` (month/year), `SegmentedControl` (day/week toggle if present), motion helpers.

**Constraint:** This is a chrome pass — DO NOT change scheduling logic, time-slot math, or appointment rendering rules.

- [ ] **Step 1: Chrome**

Read the three files. Modernize: navigation buttons (prev/today/next) → `Button` variants with icons; month-year-picker → `Select`-based or `DatePicker`-styled control; day/week toggle → `SegmentedControl`; appointment blocks get hover states (subtle ring/brightness) and the appointment modal opens with motion (AnimatePresence via `Dialog` already animates). Preserve all logic.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 20: Customers + services pages

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/customers/page.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/services/page.tsx`
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Table` (existing), `Input` (search), `Badge`, `Button`, `EmptyState`, `Skeleton`, `Dialog`, `Field`.

- [ ] **Step 1: Customers**

Modernize the customers table: search `Input` with icon, status `Badge`s, row hover, `EmptyState` for no results, skeleton while loading, edit dialog restyled with `Field`s. Preserve endpoints/payloads.

- [ ] **Step 2: Services page**

If it duplicates the settings services tab, keep the page but apply the same list/dialog treatment from Task 14 (or reuse components). Preserve behavior.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 21: Billing + analytics pages + staff-card/gcal modal restyle

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/billing/page.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/analytics/page.tsx`
- Modify: `apps/web/src/components/dashboard/gcal-convert-modal.tsx` (restyle only)
- Modify: `apps/web/src/components/dashboard/staff-card.tsx` (if not fully restyled in Task 13)
- Modify: `packages/i18n/messages/{he,en,ar}.json`

**Interfaces:**
- Consumes: `Card`, `Badge`, `Button`, `Skeleton`, `EmptyState`, `FormSection`/`SettingRow`, motion helpers.

- [ ] **Step 1: Billing**

Status → `Badge` (active/trial/past-due), plan card with icon + `Button`, skeleton while loading. Preserve endpoints/payloads.

- [ ] **Step 2: Analytics**

Stat cards consistent with Task 17 styling; skeleton loading; `EmptyState` when no data. Preserve chart/stat logic.

- [ ] **Step 3: gcal-convert-modal**

Restyle to `Dialog` + `Field`s + `Button loading` + toast; preserve conversion logic and endpoints.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @torup/web type-check`
Expected: no errors.

### Task 22: Final verification + fixes

**Files:**
- Any dashboard files with remaining raw elements.

- [ ] **Step 1: Raw-element sweep**

Grep the dashboard for violations:
```bash
cd apps/web/src && grep -rn "<select\|type=\"time\"\|bg-green-50\|bg-blue-600\|border-border px-2 py-1" app/[locale]/dashboard components/dashboard
```
Fix every hit using the new primitives (or remove).

- [ ] **Step 2: i18n completeness**

Ensure no hardcoded Hebrew/English strings remain in dashboard JSX (next-intl `t()` usage only). Fix any misses.

- [ ] **Step 3: Full gates**

Run from worktree root:
```bash
pnpm --filter @torup/ui type-check && pnpm --filter @torup/ui build && pnpm --filter @torup/ui test
pnpm --filter @torup/web type-check
```
Expected: all green.

- [ ] **Step 4: RTL sanity**

Spot-check that new layouts use logical properties (no `left-`/`right-` positioning for directional chrome). Fix any violations.

- [ ] **Step 5: Report**

Write the final state summary to `.superpowers/sdd/progress.md` (controller updates ledger as well).
