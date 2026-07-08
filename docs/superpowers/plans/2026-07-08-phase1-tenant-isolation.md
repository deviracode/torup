# Phase 1 — Tenant Isolation (RLS-enforced) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Postgres RLS the enforcement boundary for authenticated dashboard requests, so a member physically cannot read or write another tenant's data even if they forge the `:businessId` in the URL.

**Architecture:** Add a per-request JWT-scoped Supabase "user client" to `@torup/db`. In `requireAuth`, build a `RequestContext` that carries this user client plus the resolved membership. Authenticated routes read the user client from the request instead of calling `createServiceClient()`. Manual `.eq("business_id")` filters stay in place this phase (belt-and-suspenders); RLS becomes the real boundary. Fix the `.single()` membership crash. Internal/webhook/public routes are explicitly NOT migrated — they stay on service-role/anon.

**Tech Stack:** Express 5, `@supabase/supabase-js`, TypeScript (ESM, `.js` import specifiers), Vitest + supertest.

## Global Constraints

- ESM imports use `.js` specifiers even for `.ts` source (e.g. `import { x } from "./foo.js"`). Copy this convention exactly.
- Supabase clients are typed `SupabaseClient<Database>` from `@torup/db`.
- Authenticated routes must never call `createServiceClient()` after this phase. Exception list (stay service-role): everything under `routes/internal.ts`, `routes/webhooks.ts`, and any code path reached only via `x-internal-secret` or a scheduler.
- The public URL scheme `/api/businesses/:businessId/...` does NOT change.
- Do not remove existing `.eq("business_id", businessId)` filters in this phase.
- Commit after every task. Conventional Commit messages.

---

### Task 1: Add `createUserClient(accessToken)` to `@torup/db`

**Files:**
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/src/index.ts` (export the new function if not wildcard-exported)
- Test: `packages/db/src/__tests__/client.test.ts` (Create)

**Interfaces:**
- Consumes: existing `createClient(url?, key?)` from `packages/db/src/client.ts`.
- Produces: `createUserClient(accessToken: string): SupabaseClient<Database>` — a client that sends `Authorization: Bearer <accessToken>` on every PostgREST request so RLS runs as that user. Uses the anon key (RLS applies), NOT the service-role key.

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/src/__tests__/client.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createUserClient } from "../client.js";

describe("createUserClient", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
  });

  it("attaches the access token as an Authorization header", () => {
    const client = createUserClient("jwt-123");
    // supabase-js stores global headers on the rest client
    const headers = (client as unknown as {
      rest: { headers: Record<string, string> };
    }).rest.headers;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("throws when access token is empty", () => {
    expect(() => createUserClient("")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @torup/db test`
Expected: FAIL — `createUserClient is not exported` / not a function.

- [ ] **Step 3: Implement `createUserClient`**

```ts
// packages/db/src/client.ts — add below existing createClient
export function createUserClient(accessToken: string) {
  if (!accessToken) {
    throw new Error("createUserClient requires a non-empty access token");
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return supabaseCreateClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 4: Export it**

`packages/db/src/index.ts` uses named exports. Change the client export line to include the new function:

```ts
export { createClient, createUserClient } from "./client.js";
export type { Database } from "./types.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @torup/db test`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/client.ts packages/db/src/index.ts packages/db/src/__tests__/client.test.ts
git commit -m "feat(db): add createUserClient for RLS-scoped requests"
```

---

### Task 2: Add per-request `RequestContext` builder

**Files:**
- Create: `apps/api/src/lib/request-context.ts`
- Test: `apps/api/src/__tests__/request-context.test.ts`

**Interfaces:**
- Consumes: `createUserClient` (Task 1), `createServiceClient` from `apps/api/src/lib/supabase.js`.
- Produces:
  - `interface RequestContext { userId: string; userEmail?: string; role: "super_admin" | "business_owner" | "staff"; memberships: Array<{ businessId: string; role: "owner" | "staff" }>; userClient: SupabaseClient<Database>; }`
  - `function buildRequestContext(accessToken: string, user: { id: string; email?: string; isSuperAdmin: boolean }, memberships: Array<{ businessId: string; role: "owner" | "staff" }>): RequestContext`
  - Later tasks read `req.ctx?.userClient` and `req.ctx?.memberships`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/__tests__/request-context.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildRequestContext } from "../lib/request-context.js";

describe("buildRequestContext", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
  });

  it("marks super_admin role", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: true }, []);
    expect(ctx.role).toBe("super_admin");
  });

  it("derives business_owner from an owner membership", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: false }, [
      { businessId: "b1", role: "owner" },
    ]);
    expect(ctx.role).toBe("business_owner");
    expect(ctx.memberships).toHaveLength(1);
  });

  it("derives staff role and carries a user client", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: false }, [
      { businessId: "b1", role: "staff" },
    ]);
    expect(ctx.role).toBe("staff");
    expect(ctx.userClient).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @torup/api test request-context`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the context builder**

```ts
// apps/api/src/lib/request-context.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@torup/db";
import type { Database } from "@torup/db";

export interface RequestContext {
  userId: string;
  userEmail?: string;
  role: "super_admin" | "business_owner" | "staff";
  memberships: Array<{ businessId: string; role: "owner" | "staff" }>;
  userClient: SupabaseClient<Database>;
}

export function buildRequestContext(
  accessToken: string,
  user: { id: string; email?: string; isSuperAdmin: boolean },
  memberships: Array<{ businessId: string; role: "owner" | "staff" }>
): RequestContext {
  let role: RequestContext["role"];
  if (user.isSuperAdmin) {
    role = "super_admin";
  } else if (memberships.some((m) => m.role === "owner")) {
    role = "business_owner";
  } else {
    role = "staff";
  }

  return {
    userId: user.id,
    userEmail: user.email,
    role,
    memberships,
    userClient: createUserClient(accessToken),
  };
}
```

Note: `Database` is exported as a type from `@torup/db` (`export type { Database } from "./types.js"`), so `import type { Database } from "@torup/db"` works directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @torup/api test request-context`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/request-context.ts apps/api/src/__tests__/request-context.test.ts
git commit -m "feat(api): add per-request RequestContext with RLS user client"
```

---

### Task 3: Rewrite `requireAuth` to attach context and fix the `.single()` bug

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Test: `apps/api/src/__tests__/auth-middleware.test.ts` (Create)

**Interfaces:**
- Consumes: `buildRequestContext` (Task 2).
- Produces:
  - Extends `AuthenticatedRequest` with `ctx?: RequestContext` and keeps existing `userId/userEmail/userRole/businessId` for backward compat during migration.
  - `requireBusinessAccess` now checks membership against `req.ctx.memberships` (the URL id must be one the user is a member of), and still 403s fast. It is no longer the security boundary.

- [ ] **Step 1: Write the failing test (membership plurality + access)**

```ts
// apps/api/src/__tests__/auth-middleware.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Response, NextFunction } from "express";
import { requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth.js";

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireBusinessAccess", () => {
  it("allows a member of the URL business (even with multiple memberships)", () => {
    const req = {
      params: { businessId: "b2" },
      ctx: {
        role: "business_owner",
        memberships: [
          { businessId: "b1", role: "owner" },
          { businessId: "b2", role: "staff" },
        ],
      },
    } as unknown as AuthenticatedRequest;
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("403s when user is not a member of the URL business", () => {
    const req = {
      params: { businessId: "b9" },
      ctx: { role: "staff", memberships: [{ businessId: "b1", role: "staff" }] },
    } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("always allows super_admin", () => {
    const req = {
      params: { businessId: "bX" },
      ctx: { role: "super_admin", memberships: [] },
    } as unknown as AuthenticatedRequest;
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @torup/api test auth-middleware`
Expected: FAIL — `requireBusinessAccess` still reads `req.businessId`, so the multi-membership case fails or the shape mismatch throws.

- [ ] **Step 3: Rewrite `auth.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { createClient } from "@torup/db";
import { createServiceClient } from "../lib/supabase.js";
import { buildRequestContext, type RequestContext } from "../lib/request-context.js";

export interface AuthenticatedRequest extends Request {
  ctx?: RequestContext;
  // Back-compat fields (kept until all routes read ctx)
  userId?: string;
  userEmail?: string;
  userRole?: "super_admin" | "business_owner" | "staff";
  businessId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }
  const token = authHeader.substring(7);

  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const isSuperAdmin = user.user_metadata?.role === "super_admin";

    // Fetch ALL memberships (fixes the .single() crash for 0/many rows)
    const serviceClient = createServiceClient();
    const { data: membershipRows } = await serviceClient
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", user.id);

    const memberships = (membershipRows ?? []).map((m) => ({
      businessId: m.business_id as string,
      role: m.role as "owner" | "staff",
    }));

    const ctx = buildRequestContext(
      token,
      { id: user.id, email: user.email, isSuperAdmin },
      memberships
    );
    req.ctx = ctx;

    // Back-compat mirror
    req.userId = ctx.userId;
    req.userEmail = ctx.userEmail;
    req.userRole = ctx.role;
    req.businessId = memberships[0]?.businessId;

    next();
  } catch (err) {
    console.error("[auth middleware]", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

export function requireRole(...roles: Array<"super_admin" | "business_owner" | "staff">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.ctx || !roles.includes(req.ctx.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireBusinessAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const businessId = req.params.businessId || req.params.id;

  if (req.ctx?.role === "super_admin") {
    next();
    return;
  }

  const isMember = req.ctx?.memberships.some((m) => m.businessId === businessId);
  if (!isMember) {
    res.status(403).json({ error: "Access denied to this business" });
    return;
  }
  next();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @torup/api test auth-middleware`
Expected: PASS (all three cases).

- [ ] **Step 5: Run full API test + typecheck (nothing else broke)**

Run: `pnpm --filter @torup/api test && pnpm --filter @torup/api type-check`
Expected: PASS. `requireRole` now reads `req.ctx.role`; confirm no route relied on `requireRole` before `requireAuth` ran (grep in Step of Task 4).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/__tests__/auth-middleware.test.ts
git commit -m "feat(api): attach RequestContext in requireAuth; support multi-membership users"
```

---

### Task 4: Add `getUserClient(req)` helper and migrate `appointments.ts` reads/writes to the user client

**Files:**
- Modify: `apps/api/src/lib/params.ts` (add `getUserClient`)
- Modify: `apps/api/src/routes/appointments.ts`
- Test: reuse existing `apps/api/src/__tests__/*` (no new unit test; verification is typecheck + the RLS integration test in Task 5)

**Interfaces:**
- Consumes: `req.ctx.userClient` (Task 3).
- Produces: `function getUserClient(req: AuthenticatedRequest): SupabaseClient<Database>` — returns `req.ctx.userClient` or throws `AppError(500, "No request context")` if missing. Authenticated route handlers call this instead of `createServiceClient()`.

Rationale for this task's boundary: `appointments.ts` is the highest-risk, most-read router and the Phase-2 reference module. Migrating it first proves the pattern end-to-end. The `POST /` public-booking handler in this file (no `requireAuth`) stays on `createServiceClient()` — it is a public path.

- [ ] **Step 1: Add the helper**

```ts
// apps/api/src/lib/params.ts — append
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

export function getUserClient(req: AuthenticatedRequest): SupabaseClient<Database> {
  if (!req.ctx?.userClient) {
    throw new AppError(500, "No request context (requireAuth must run first)");
  }
  return req.ctx.userClient;
}
```

Use `import type { Database } from "@torup/db"` (exported as a type from the package root).

- [ ] **Step 2: Migrate the authenticated handlers in `appointments.ts`**

In every handler that has `requireAuth, requireBusinessAccess` (the `GET /`, `PATCH /:id/status`, `PATCH /:id/reschedule`, `POST /:id/approve`, `POST /:id/reject` handlers), replace:

```ts
const supabase = createServiceClient();
```

with:

```ts
const supabase = getUserClient(req);
```

Leave the `POST /` handler (public booking, no `requireAuth`) on `createServiceClient()`. Add `import { getUserClient } from "../lib/params.js";` to the existing params import line. Keep all existing `.eq("business_id", businessId)` filters.

Note on `approveAppointment`/`rejectAppointment` and `sendAppointmentNotification`: these are service functions that construct their own service-role client internally — they are unchanged (system operations). Only the direct table queries in the route move to the user client.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @torup/api type-check`
Expected: PASS.

- [ ] **Step 4: Run API tests**

Run: `pnpm --filter @torup/api test`
Expected: PASS (unit tests unaffected — they don't hit these routes with a DB).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/params.ts apps/api/src/routes/appointments.ts
git commit -m "feat(api): route appointments reads/writes through RLS user client"
```

---

### Task 5: RLS integration test proving cross-tenant denial

**Files:**
- Create: `apps/api/src/__tests__/rls-isolation.integration.test.ts`

**Interfaces:**
- Consumes: `createUserClient` (Task 1). Requires a live Supabase with the migrations applied and two seeded businesses + members. Skips automatically when env is absent so CI without a DB stays green.

Rationale: this is the test that actually proves the security goal. It must run against a real Postgres because RLS cannot be exercised in-memory.

- [ ] **Step 1: Write the integration test (self-skipping)**

```ts
// apps/api/src/__tests__/rls-isolation.integration.test.ts
import { describe, it, expect } from "vitest";
import { createUserClient } from "@torup/db";

const HAS_DB =
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_ANON_KEY &&
  !!process.env.RLS_TEST_JWT_B1 &&
  !!process.env.RLS_TEST_BUSINESS_B2;

describe.skipIf(!HAS_DB)("RLS tenant isolation", () => {
  it("a member of B1 cannot read B2 appointments even with explicit filter", async () => {
    const clientB1 = createUserClient(process.env.RLS_TEST_JWT_B1!);
    const { data, error } = await clientB1
      .from("appointments")
      .select("id")
      .eq("business_id", process.env.RLS_TEST_BUSINESS_B2!);
    // RLS yields zero rows (not an error) for the other tenant
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("a member of B1 cannot insert an appointment into B2", async () => {
    const clientB1 = createUserClient(process.env.RLS_TEST_JWT_B1!);
    const { error } = await clientB1.from("appointments").insert({
      business_id: process.env.RLS_TEST_BUSINESS_B2!,
      service_id: "00000000-0000-0000-0000-000000000000",
      customer_id: "00000000-0000-0000-0000-000000000000",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(error).not.toBeNull(); // RLS policy blocks the write
  });
});
```

- [ ] **Step 2: Run without DB env (must skip, not fail)**

Run: `pnpm --filter @torup/api test rls-isolation`
Expected: test suite reports skipped (0 failures).

- [ ] **Step 3: Document how to run it with a DB**

Add to the plan's sibling doc or the test's top comment: set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RLS_TEST_JWT_B1` (a real user JWT for a member of business B1), and `RLS_TEST_BUSINESS_B2` (B2's id) against a Supabase instance with migrations applied, then rerun. Manually confirm both assertions pass at least once locally.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/rls-isolation.integration.test.ts
git commit -m "test(api): RLS cross-tenant isolation integration test (self-skipping)"
```

---

### Task 6: Audit RLS policies for authenticated write coverage

**Files:**
- Read: `supabase/migrations/00002_rls_policies.sql` and later migrations touching policies
- Create (only if a gap is found): `supabase/migrations/00025_rls_authenticated_writes.sql`

**Interfaces:** none (DB policy layer).

Rationale: once authenticated routes use the user client, every authenticated operation must have a matching RLS policy or it will silently break (empty results / denied writes). Verify the set.

- [ ] **Step 1: Enumerate authenticated operations per table**

For each table an authenticated route writes (`appointments`, `services`, `working_hours`, `breaks`, `booking_rules`, `waitlist`, `business_members`, `businesses`, `notifications_log`, `subscriptions`, plus any in later migrations like `service_categories`, `staff_services`, `google_calendar_tokens`, `reminder_settings`), list the SELECT/INSERT/UPDATE/DELETE the dashboard performs.

Run: `grep -rn "\.from(\"" apps/api/src/routes | grep -v internal | grep -v webhooks`
Cross-reference each table against the policies in `00002_rls_policies.sql` and later `*_rls.sql` migrations.

- [ ] **Step 2: Record the audit result**

Write findings inline in this task's checkbox as a short table: `table | op | policy exists? (yes/no) | policy name`. Any `no` for an operation the dashboard performs is a gap.

- [ ] **Step 3: If gaps exist, add a migration**

Only if Step 2 found a gap. Example shape (fill with the actual missing policies found):

```sql
-- supabase/migrations/00025_rls_authenticated_writes.sql
-- Close RLS gaps surfaced by moving authenticated routes to the user client.
-- (Add only the specific policies identified in the Task 6 audit.)
```

If no gaps: note "no migration needed" in the checkbox and skip.

- [ ] **Step 4: If a migration was added, verify it applies**

Run: `pnpm --filter @torup/db supabase db reset` (or the project's migration-apply command; check `packages/db/package.json` scripts first).
Expected: migrations apply cleanly.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ docs/superpowers/plans/2026-07-08-phase1-tenant-isolation.md
git commit -m "chore(db): audit + close RLS gaps for authenticated dashboard writes"
```

---

## Self-Review

**Spec coverage (Phase 1 scope only):**
- Spec §4.1 user client → Task 1. ✓
- Spec §4.2 RequestContext in requireAuth → Tasks 2, 3. ✓
- Spec §4.3 authenticated routes use user client → Task 4 (appointments as first/reference; remaining 15 routes are Phase 3, explicitly out of scope here). ✓
- Spec §4.4 requireBusinessAccess demoted to fast-403 → Task 3. ✓
- Spec §4.5 fix `.single()` bug → Task 3. ✓
- Spec §Risks "RLS gaps" audit → Task 6. ✓
- Proof of isolation → Task 5. ✓

**Deliberate scope boundary:** Only `appointments.ts` migrates to the user client in Phase 1 (Task 4). The other 15 routers move in Phase 3. This is intentional — Phase 1 proves the mechanism and the security boundary end-to-end on the highest-risk router; a big-bang migration of all routers is Phase 3's job.

**Placeholder scan:** Task 6 Step 3 is conditional-by-design (migration only if audit finds a gap), not a placeholder — the audit is the deliverable and the migration content is defined by its findings. No TBD/TODO elsewhere.

**Type consistency:** `RequestContext`, `buildRequestContext`, `getUserClient`, `createUserClient` signatures match across Tasks 1–4. `memberships` shape `{ businessId, role }` consistent in Tasks 2, 3, and the `requireBusinessAccess` test.
