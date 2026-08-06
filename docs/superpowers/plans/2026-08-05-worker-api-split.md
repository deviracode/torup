# Worker/API Deployment Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the `apps/api` codebase into two deployable modes — a customer-facing public API and an internal worker (internal routes + in-process schedulers) — controlled by a single `WORKER_ENABLED` env flag, with local dev still running as one unit.

**Architecture:** Extract all Express app construction into a `createApp(options)` factory in a new `apps/api/src/app.ts`. `index.ts` becomes a thin entrypoint reading `WORKER_ENABLED`; when `true` it mounts the internal router and starts the reminder + Google Calendar schedulers, otherwise it serves customer routes only. One Dockerfile, one bundle, two Railway services differing only in env vars.

**Tech Stack:** Express 5, TypeScript, esbuild (docker build), vitest + supertest, pnpm/turbo monorepo, Railway (Dockerfile builder).

**Spec:** `docs/superpowers/specs/2026-08-05-worker-api-split-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/app.ts` | Create | `createApp(options)` factory — all middleware, limiters, routes, internal router, health check, scheduler startup |
| `apps/api/src/index.ts` | Rewrite | Thin entrypoint: read `WORKER_ENABLED`, build app via factory, `listen` |
| `apps/api/src/__tests__/app-factory.test.ts` | Create | Tests factory gating: internal routes mount, scheduler startup, health check |
| `apps/api/package.json` | Modify | `dev` script sets `WORKER_ENABLED=true` so local dev = one unit with schedulers |

No changes to `apps/api/Dockerfile` or `build:docker` — the bundle entrypoint stays `src/index.ts`.

Reference points (do not modify):
- `apps/api/src/routes/internal.ts` — internal router (moved intact into factory)
- `apps/api/src/services/notifications.ts:707` — `startReminderScheduler`
- `apps/api/src/services/google-calendar.ts:259` — `startGCalSyncScheduler`
- `apps/api/src/index.ts:108-116` — current scheduler gating (to be replaced)

---

### Task 1: Write the failing factory test

**Files:**
- Create: `apps/api/src/__tests__/app-factory.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../services/notifications", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/notifications")>();
  return { ...mod, startReminderScheduler: vi.fn(), stopReminderScheduler: vi.fn() };
});

vi.mock("../services/google-calendar", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/google-calendar")>();
  return { ...mod, startGCalSyncScheduler: vi.fn(), stopGCalSyncScheduler: vi.fn() };
});

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to public-only: no internal routes, no schedulers", async () => {
    const { createApp } = await import("../app");
    const app = createApp({});

    const res = await request(app).post("/api/internal/reminders/tick");
    expect(res.status).toBe(404);

    const { startReminderScheduler } = await import("../services/notifications");
    const { startGCalSyncScheduler } = await import("../services/google-calendar");
    expect(startReminderScheduler).not.toHaveBeenCalled();
    expect(startGCalSyncScheduler).not.toHaveBeenCalled();
  });

  it("mounts internal routes when mountInternal is true (secret still required)", async () => {
    const { createApp } = await import("../app");
    const app = createApp({ mountInternal: true });

    const res = await request(app).post("/api/internal/reminders/tick");
    expect(res.status).toBe(401);
  });

  it("starts schedulers when startSchedulers is true", async () => {
    const { createApp } = await import("../app");
    createApp({ startSchedulers: true });

    const { startReminderScheduler } = await import("../services/notifications");
    const { startGCalSyncScheduler } = await import("../services/google-calendar");
    expect(startReminderScheduler).toHaveBeenCalledTimes(1);
    expect(startGCalSyncScheduler).toHaveBeenCalledTimes(1);
  });

  it("always serves the health check", async () => {
    const { createApp } = await import("../app");
    const app = createApp({});

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @torup/api test -- app-factory`

Expected: FAIL — "Cannot find module '../app'" (or `createApp` is not a function if `app.ts` was partially created).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/app-factory.test.ts
git commit -m "test(api): add createApp factory gating tests"
```

---

### Task 2: Create the `createApp` factory

**Files:**
- Create: `apps/api/src/app.ts`

- [ ] **Step 1: Create `apps/api/src/app.ts` with the full app construction moved from `index.ts`**

Copy the entire contents of the current `apps/api/src/index.ts`, then make these changes:

1. Keep all imports as-is (they are all needed by the factory), and add:

```ts
export type AppOptions = {
  mountInternal?: boolean;
  startSchedulers?: boolean;
};
```

2. Wrap the app construction in the factory (everything from `const app: Express = express();` through `app.use(errorHandler);` moves inside), leaving `app.listen` out:

```ts
export function createApp(options: AppOptions = {}): Express {
  const { mountInternal = false, startSchedulers = false } = options;
  const app: Express = express();

  // Global middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN === "*"
      ? true
      : process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",")
        : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
    credentials: true,
  }));
  app.use(express.json());

  // Unauthenticated (public) routes: strict IP-based limit
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 200 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Authenticated dashboard routes: generous per-token limit
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 2000 : 10000,
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) return auth.slice(7, 50);
      return req.ip ?? "unknown";
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", (req, res, next) => {
    if (req.path.startsWith("/internal/")) return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return authLimiter(req, res, next);
    return publicLimiter(req, res, next);
  });

  // Internal routes (scheduler-driven, secret-protected) — only in worker mode
  if (mountInternal) {
    app.use("/api/internal", internalRouter);
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Business routes (public + auth)
  app.use("/api/businesses", businessesRouter);

  // Business-scoped routes
  app.use("/api/businesses/:businessId/services", servicesRouter);
  app.use("/api/businesses/:businessId/categories", categoriesRouter);
  app.use("/api/businesses/:businessId", configurationRouter);
  app.use("/api/businesses/:businessId/appointments", appointmentsRouter);
  app.use("/api/businesses/:businessId/availability", availabilityRouter);
  app.use("/api/businesses/:businessId/customers", customersRouter);
  app.use("/api/businesses/:businessId/staff", staffRouter);
  app.use("/api/businesses/:businessId/waitlist", waitlistRouter);
  app.use("/api/businesses/:businessId/analytics", analyticsRouter);
  app.use("/api/businesses/:businessId/notifications", notificationsRouter);
  app.use("/api/businesses/:businessId/google-calendar", googleCalendarRouter);
  app.use("/api/businesses/:businessId/whatsapp", whatsappCredentialsRouter);

  // Admin routes
  app.use("/api/admin", adminRouter);

  // Billing routes
  app.use("/api/billing", billingRouter);

  // Webhook routes
  app.use("/api/webhooks", webhooksRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  if (startSchedulers) {
    startReminderScheduler();
    startGCalSyncScheduler();
  }

  return app;
}
```

3. Delete the `app.listen(...)` block and the `export default app;` line from this file.

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm --filter @torup/api test -- app-factory`

Expected: 4 tests PASS.

- [ ] **Step 3: Verify type-check**

Run: `pnpm --filter @torup/api type-check`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): extract createApp factory from index.ts"
```

---

### Task 3: Rewrite `index.ts` as the thin entrypoint

**Files:**
- Rewrite: `apps/api/src/index.ts`

- [ ] **Step 1: Replace the entire file contents with**

```ts
import "dotenv/config";
import { createApp } from "./app";

const isWorker = process.env.WORKER_ENABLED === "true";

const app = createApp({
  mountInternal: isWorker,
  startSchedulers: isWorker,
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  if (isWorker) {
    console.log("Worker mode enabled: internal routes + in-process schedulers active");
  }
});

export default app;
```

Note: `export default app` is kept for compatibility with any tooling importing the app instance.

- [ ] **Step 2: Verify no other file references `ENABLE_INPROCESS_REMINDER_SCHEDULER`**

Run: `grep -rn "ENABLE_INPROCESS_REMINDER_SCHEDULER" apps/ services/ --include="*.ts" --include="*.json"`

Expected: no matches (the flag is fully removed).

- [ ] **Step 3: Run the full API test suite**

Run: `pnpm --filter @torup/api test`

Expected: all tests PASS (the existing `reminder-dispatch.test.ts` builds its own app with the internal router, so it is unaffected).

- [ ] **Step 4: Verify type-check**

Run: `pnpm --filter @torup/api type-check`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): gate worker mode on WORKER_ENABLED env flag"
```

---

### Task 4: Update the dev script for one-unit local development

**Files:**
- Modify: `apps/api/package.json` (the `"dev"` script)

- [ ] **Step 1: Change the dev script**

From:

```json
"dev": "tsx watch src/index.ts",
```

To:

```json
"dev": "WORKER_ENABLED=true tsx watch src/index.ts",
```

- [ ] **Step 2: Smoke-test local dev**

Run: `pnpm --filter @torup/api dev`

Expected: logs `API server running on http://localhost:3001` and `Worker mode enabled: internal routes + in-process schedulers active`. Then press Ctrl-C to stop.

Note: schedulers log their own startup lines ("Reminder scheduler started (every 5 minutes)", "Google Calendar sync scheduler started (every 15 minutes)") — if those are missing, the process may be missing required env vars (Supabase keys), which is fine for this smoke test; the worker-mode line is the signal that the split works.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json
git commit -m "chore(api): run schedulers in local dev via WORKER_ENABLED"
```

---

### Task 5: Verify the Docker build still produces a working bundle

**Files:**
- None (verification only)

- [ ] **Step 1: Run the docker build**

Run: `docker build -f apps/api/Dockerfile -t torup-api:split-test .`

Expected: image builds successfully, ending with `CMD ["node", "dist/index.js"]`.

- [ ] **Step 2: Run the image in both modes (health check smoke test)**

```bash
docker run --rm -d -p 3999:3001 -e PORT=3001 --name torup-api-pub torup-api:split-test
docker run --rm -d -p 3998:3001 -e PORT=3001 -e WORKER_ENABLED=true --name torup-api-worker torup-api:split-test
```

Then:

```bash
curl -s http://localhost:3999/api/health
curl -s http://localhost:3998/api/health
curl -s -X POST http://localhost:3999/api/internal/reminders/tick -o /dev/null -w "%{http_code}\n"
curl -s -X POST http://localhost:3998/api/internal/reminders/tick -o /dev/null -w "%{http_code}\n"
```

Expected: both health checks return `{"status":"ok",...}`; public container returns `404` for the internal route; worker container returns `401` (route exists, secret missing).

- [ ] **Step 3: Clean up containers**

```bash
docker stop torup-api-pub torup-api-worker
docker rmi torup-api:split-test
```

---

### Task 6: Railway deployment checklist (manual, one-time)

**Files:**
- None (Railway dashboard/CLI configuration)

- [ ] **Step 1: Create the worker service on Railway**

In the existing Railway project, add a second service pointing at the same GitHub repo and the same `apps/api` directory with the Dockerfile builder (same as the public API service).

- [ ] **Step 2: Set the worker's env vars**

| Variable | Value |
|---|---|
| `WORKER_ENABLED` | `true` |
| `INTERNAL_SECRET` | a strong secret (the worker's internal routes are only protected by this header) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `REDIS_URL` / all shared vars | same as the public API service |

- [ ] **Step 3: Point whatsapp-agent at the worker**

In the whatsapp-agent service on Railway, set `API_INTERNAL_URL` to the worker's Railway domain (e.g. `https://<worker>.up.railway.app`). Verify its existing fallback chain (`API_INTERNAL_URL || API_URL || http://localhost:3001` at `services/whatsapp-agent/src/index.ts:529,850`) is not otherwise affected.

- [ ] **Step 4: Remove the obsolete flag**

Confirm the public API service does not set `WORKER_ENABLED` and that no service sets `ENABLE_INPROCESS_REMINDER_SCHEDULER` anymore.

- [ ] **Step 5: Deploy and verify**

Deploy both services; verify:
- `GET <public>/api/health` → ok
- `GET <worker>/api/health` → ok
- `POST <worker>/api/internal/reminders/tick` with `x-internal-secret` header → JSON counts (manual trigger works)
- whatsapp-agent still delivers approve/reject/notify flows (agent → worker)

---

## Self-Review Notes

- **Spec coverage:** factory extraction (Tasks 1-2), entrypoint + `WORKER_ENABLED` (Task 3), local one-unit dev (Task 4), unchanged Dockerfile (Task 5), Railway two-service setup + env vars + whatsapp-agent `API_INTERNAL_URL` (Task 6). The `ENABLE_INPROCESS_REMINDER_SCHEDULER` removal is verified in Task 3 Step 2.
- **Schedulers call functions directly** — unchanged from current implementation; the worker's tick endpoints remain mounted for manual triggers (covered by Task 2 + Task 6 verification).
- **No test breaks expected:** all existing tests build their own Express apps from routers (`reminder-dispatch.test.ts:71-76` is the pattern); none import `index.ts`.
