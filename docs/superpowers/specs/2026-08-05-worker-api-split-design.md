# Worker/API Deployment Split Design

Date: 2026-08-05
Status: Approved

## Problem

The API (`apps/api`) currently mixes two concerns in one deployment:

1. **Customer-facing HTTP endpoints** — businesses, appointments, availability, webhooks, etc.
2. **Background work** — in-process cron schedulers (reminders + auto-complete every 5 min, Google Calendar sync every 15 min) and secret-protected internal routes (`/api/internal/*`) used by the whatsapp-agent service and manual triggers.

Running both in one process means background jobs share resources with latency-sensitive customer traffic, the public surface exposes internal machinery, and there is no way to scale or isolate the two workloads independently.

## Goal

Keep a **single codebase** (`apps/api`) but deploy **two separate Railway services**:

- **Public API** — serves only customer-facing endpoints.
- **Worker** — serves the internal routes and runs the in-process schedulers.

Local development must continue to work as **one unit**: a single process running all routes + schedulers.

## Current State

- `apps/api/src/index.ts` builds the Express app: global middleware, rate limiters, public routes, internal router (`/api/internal`), health check, and conditionally starts schedulers when `ENABLE_INPROCESS_REMINDER_SCHEDULER=true`.
- `apps/api/src/routes/internal.ts` — secret-protected routes: `reminders/tick`, `notify-manager`, `appointments/:id/approve|reject`, `google-calendar/sync`.
- Schedulers: `startReminderScheduler` (5 min: `processReminders` + `autoCompletePastAppointments`), `startGCalSyncScheduler` (15 min) — in `services/notifications.ts` and `services/google-calendar.ts`.
- whatsapp-agent calls internal endpoints with fallback `API_INTERNAL_URL || API_URL || localhost:3001` (`services/whatsapp-agent/src/index.ts:529,850`).
- Frontend does **not** use internal routes — its "Sync now" button calls the public route `POST /api/businesses/:businessId/google-calendar/sync`.
- Docker: `apps/api/Dockerfile` bundles `src/index.ts` → `dist/index.js` via esbuild; Railway uses the Dockerfile builder.

## Design

### App factory

New `apps/api/src/app.ts` exports:

```ts
type AppOptions = {
  mountInternal?: boolean;   // mount /api/internal router
  startSchedulers?: boolean; // start reminder + gcal schedulers
};

function createApp(options: AppOptions): Express
```

All middleware, rate limiters, public routes, internal router, and health check move from `index.ts` into `createApp`. The `ENABLE_INPROCESS_REMINDER_SCHEDULER` flag is removed entirely.

### Entrypoint

`apps/api/src/index.ts` becomes a thin entrypoint:

```ts
const isWorker = process.env.WORKER_ENABLED === "true";
const app = createApp({
  mountInternal: isWorker,
  startSchedulers: isWorker,
});
app.listen(port, ...);
```

`WORKER_ENABLED` is the single, general switch. Future async jobs follow the existing pattern — a `startX()` function called from the worker startup path — without new flags.

### Runtime modes

| Mode | Env | Mounts |
|---|---|---|
| Local dev | `WORKER_ENABLED=true` (set in `pnpm dev` script) | everything — one process |
| Public API (Railway) | `WORKER_ENABLED` unset | customer routes only |
| Worker (Railway) | `WORKER_ENABLED=true` | customer routes + internal routes + schedulers |

Local dev gets schedulers on by default (previously opt-in via env flag).

### Worker behavior

- Worker scheduler calls `processReminders()` / `syncGoogleCalendar()` **directly** (no HTTP self-calls).
- Internal tick endpoints (`reminders/tick`, `google-calendar/sync`) stay mounted on the worker as manual-trigger/debugging tools (protected by `INTERNAL_SECRET`).
- whatsapp-agent keeps calling `/api/internal/notify-manager` and `/api/internal/appointments/:id/approve|reject`; on Railway its `API_INTERNAL_URL` points at the worker. No whatsapp-agent code changes.

### Docker & Railway

- `build:docker` and `apps/api/Dockerfile` are **unchanged** — both services run the same image and the same start command (`node dist/index.js`).
- Railway: add a second service to the existing project, same repo directory (`apps/api`), same Dockerfile builder.
- The two services differ **only in env vars**.

### Env vars per service

| Variable | Public API | Worker |
|---|---|---|
| `WORKER_ENABLED` | unset | `true` |
| `INTERNAL_SECRET` | not needed | set (internal routes) |
| Supabase / Redis / other shared | same | same |

whatsapp-agent service: set `API_INTERNAL_URL` to the worker's Railway domain.

### Tests

Existing tests keep working — they already mount routers on a fresh Express app; the factory makes that explicit. No test changes expected beyond import paths if any.

## Out of Scope

- Moving schedulers to external cron (Railway Cron / GitHub Actions) — the worker owns in-process scheduling by design.
- Queue infrastructure (BullMQ, etc.) — out of scope; the scheduler registry pattern accommodates future async jobs.
- Changes to the frontend.

## Open Questions

None.
