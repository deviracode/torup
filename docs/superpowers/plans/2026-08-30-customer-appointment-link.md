# Customer Appointment Self-Service Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every appointment a persistent public link (`/{locale}/a/{token}`) sent via WhatsApp message templates, where a customer can confirm/decline attendance, request a date change, or request a cancellation — replacing the WhatsApp quick-reply buttons that silently fail outside the 24h session window.

**Architecture:** New `customer_link_token` column on `appointments` + a new `appointment_change_requests` table. Public, unauthenticated Express routes (token + phone as the auth, mirroring the existing public-booking route pattern) back a new Next.js page styled like the existing booking flow. Dashboard gets a new "Pending Requests" panel mirroring the existing pending-approval panel. WhatsApp reminder/confirmed templates gain a URL button; `sendInteractiveReminder` is removed.

**Tech Stack:** Express + Supabase (service-role client for all new public/private DB access), Next.js App Router + `next-intl`, Tailwind (no component library), Vitest, WhatsApp Cloud API (Meta Graph API v21.0).

---

## Spec reference

Full design: `docs/superpowers/specs/2026-08-30-customer-appointment-link-design.md`. This plan implements every section of that spec except the explicitly out-of-scope items listed there (no per-business toggle, no link on rejected templates, no cleanup of the dead WhatsApp button webhook handler, no changes to `sendManagerApprovalRequest`).

## File plan

**Migrations:**
- Create: `packages/db/supabase/migrations/00036_appointment_customer_link_token.sql`
- Create: `packages/db/supabase/migrations/00037_appointment_change_requests.sql`

**Backend:**
- Create: `apps/api/src/modules/appointments/appointment-link.repository.ts`
- Create: `apps/api/src/modules/appointments/appointment-link.service.ts`
- Create: `apps/api/src/modules/appointments/change-request.repository.ts`
- Create: `apps/api/src/modules/appointments/change-request.service.ts`
- Create: `apps/api/src/routes/public-appointment-link.ts`
- Create: `apps/api/src/routes/change-requests.ts`
- Modify: `apps/api/src/app.ts` (mount the two new route files)
- Modify: `apps/api/src/services/notifications.ts` (new notification functions + remove `isManual`/`sendInteractiveReminder` branch)
- Modify: `apps/api/src/services/whatsapp.ts` (URL button component on `sendCustomerReminderTemplate` and `sendCustomerApprovalTemplate`)
- Modify: `apps/api/src/services/whatsapp-templates.ts` (button component in the 4 affected `TEMPLATE_DEFINITIONS` entries)

**Frontend:**
- Create: `apps/web/src/app/[locale]/a/[token]/page.tsx`
- Create: `apps/web/src/components/appointment-link/appointment-link-view.tsx`
- Create: `apps/web/src/components/appointment-link/date-time-picker.tsx`
- Create: `apps/web/src/components/dashboard/pending-requests-panel.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx` (wire up the new panel)

---

## Task 1: Migration — `customer_link_token` column

**Files:**
- Create: `packages/db/supabase/migrations/00036_appointment_customer_link_token.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00036_appointment_customer_link_token.sql
-- Per-appointment public self-service link (confirm/reject attendance,
-- request edit/cancel). Sent via WhatsApp message templates (URL button),
-- which bypass the 24h conversation-session window that silently kills the
-- old WhatsApp quick-reply buttons for reminders sent long after the
-- customer's last inbound message. See
-- docs/superpowers/specs/2026-08-30-customer-appointment-link-design.md
--
-- hex (not base64url) so no custom encoding function is needed — Postgres's
-- built-in encode() only supports 'base64'/'hex'/'escape', and 'base64'
-- output isn't URL-safe as-is.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_link_token TEXT DEFAULT encode(gen_random_bytes(24), 'hex');

-- Backfill rows that predate the column default (DEFAULT only applies to
-- new inserts, not existing rows added by ALTER TABLE ... ADD COLUMN).
UPDATE appointments SET customer_link_token = encode(gen_random_bytes(24), 'hex') WHERE customer_link_token IS NULL;

ALTER TABLE appointments ALTER COLUMN customer_link_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_customer_link_token
  ON appointments(customer_link_token);
```

- [ ] **Step 2: Verify against staging (read-only dry run)**

Run: `cat supabase/.temp/project-ref` — confirm it prints `vwrsqdfunxmjjtebyxdf` (staging). If not, run `supabase link --project-ref vwrsqdfunxmjjtebyxdf` first.

Run: `supabase db push --dry-run` (from repo root)
Expected: shows `00036_appointment_customer_link_token.sql` as a pending migration with no errors.

- [ ] **Step 3: Apply to staging**

Run: `supabase db push`
Expected: migration applies cleanly; `supabase migration list --linked` shows `00036` as applied.

- [ ] **Step 4: Commit**

```bash
git add packages/db/supabase/migrations/00036_appointment_customer_link_token.sql
git commit -m "feat(db): add customer_link_token to appointments"
```

---

## Task 2: Migration — `appointment_change_requests` table

**Files:**
- Create: `packages/db/supabase/migrations/00037_appointment_change_requests.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00037_appointment_change_requests.sql
-- Customer-initiated edit/cancel requests submitted via the appointment
-- self-service link (00036), reviewed by the business owner/staff in the
-- dashboard. Service-role only, same access model as whatsapp_credentials
-- (00026) — all reads/writes go through the API's service-role client, no
-- direct anon/authenticated policies.
CREATE TABLE IF NOT EXISTS appointment_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('edit', 'cancel')),
  proposed_start_time TIMESTAMPTZ,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_change_requests_business_status
  ON appointment_change_requests(business_id, status);

CREATE INDEX IF NOT EXISTS idx_change_requests_appointment
  ON appointment_change_requests(appointment_id);

ALTER TABLE appointment_change_requests ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Dry-run + apply to staging**

Run: `supabase db push --dry-run` then `supabase db push`
Expected: `00037_appointment_change_requests.sql` applies cleanly after `00036`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/supabase/migrations/00037_appointment_change_requests.sql
git commit -m "feat(db): add appointment_change_requests table"
```

---

## Task 3: `appointment-link.repository.ts`

**Files:**
- Create: `apps/api/src/modules/appointments/appointment-link.repository.ts`
- Test: `apps/api/src/__tests__/appointment-link-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createAppointmentLinkRepo } from "../modules/appointments/appointment-link.repository";

function fakeClient(handlers: Record<string, any>) {
  return { from: vi.fn((table: string) => handlers[table]) } as any;
}

describe("appointment-link repository", () => {
  it("getByToken selects by customer_link_token and returns the joined row", async () => {
    const row = {
      id: "apt-1",
      status: "confirmed",
      start_time: "2026-09-01T10:00:00Z",
      end_time: "2026-09-01T11:00:00Z",
      business_id: "biz-1",
      service_id: "svc-1",
      customers: { id: "cust-1", name: "Dana", phone: "972501234567", language_preference: "he" },
      services: { name_he: "תספורת", name_ar: null, name_en: null },
      businesses: { name: "Studio" },
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createAppointmentLinkRepo(fakeClient({ appointments: { select } }));

    const { data } = await repo.getByToken("tok123");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("customer_link_token", "tok123");
    expect(data).toEqual(row);
  });

  it("updateAttendance sets status and customer_confirmed", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "apt-1", status: "confirmed" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const repo = createAppointmentLinkRepo(fakeClient({ appointments: { update } }));

    await repo.updateAttendance("apt-1", "confirmed", true);

    expect(update).toHaveBeenCalledWith({ status: "confirmed", customer_confirmed: true });
    expect(eq).toHaveBeenCalledWith("id", "apt-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/appointment-link-repository.test.ts`
Expected: FAIL — `Cannot find module '../modules/appointments/appointment-link.repository'`

- [ ] **Step 3: Write the implementation**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type AppointmentLinkRow = {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  business_id: string;
  service_id: string;
  customers: { id: string; name: string; phone: string; language_preference: string };
  services: { name_he: string; name_ar: string | null; name_en: string | null };
  businesses: { name: string };
};

const SELECT_COLUMNS =
  "id, status, start_time, end_time, business_id, service_id, " +
  "customers(id, name, phone, language_preference), " +
  "services(name_he, name_ar, name_en), " +
  "businesses(name)";

export function createAppointmentLinkRepo(client: SupabaseClient<Database>) {
  return {
    async getByToken(token: string) {
      const res = await client
        .from("appointments")
        .select(SELECT_COLUMNS)
        .eq("customer_link_token", token)
        .single();
      return res as unknown as { data: AppointmentLinkRow | null; error: unknown };
    },

    async updateAttendance(appointmentId: string, status: "confirmed" | "cancelled", customerConfirmed: boolean) {
      return client
        .from("appointments")
        .update({ status, customer_confirmed: customerConfirmed })
        .eq("id", appointmentId)
        .select("id, status")
        .single();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/appointment-link-repository.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/appointments/appointment-link.repository.ts apps/api/src/__tests__/appointment-link-repository.test.ts
git commit -m "feat(appointments): add appointment-link repository"
```

---

## Task 4: `appointment-link.service.ts` — phone verification + attendance

**Files:**
- Create: `apps/api/src/modules/appointments/appointment-link.service.ts`
- Test: `apps/api/src/__tests__/appointment-link-service.test.ts`

Normalizes phone the same way `services/whatsapp.ts`'s private `normalizePhone` does (`0XXXXXXXXX` → `972XXXXXXXXX`) — duplicated here as a small pure function since that one isn't exported; do not import from `whatsapp.ts` across module boundaries for a one-line utility.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createAppointmentLinkService } from "../modules/appointments/appointment-link.service";
import { AppError } from "../middleware/error-handler";

function makeRepo(row: any, overrides: any = {}) {
  return {
    getByToken: vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: "not found" } }),
    updateAttendance: vi.fn().mockResolvedValue({ data: { id: row?.id, status: "confirmed" }, error: null }),
    ...overrides,
  };
}

const ROW = {
  id: "apt-1",
  status: "confirmed",
  start_time: "2099-01-01T10:00:00Z",
  end_time: "2099-01-01T11:00:00Z",
  business_id: "biz-1",
  service_id: "svc-1",
  customers: { id: "cust-1", name: "Dana", phone: "972501234567", language_preference: "he" },
  services: { name_he: "תספורת", name_ar: null, name_en: null },
  businesses: { name: "Studio" },
};

describe("appointment-link service", () => {
  it("verifyAndGet succeeds when phone matches (normalized local format)", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any);
    const result = await svc.verifyAndGet("tok123", "0501234567");
    expect(result.id).toBe("apt-1");
    expect(result.customerPhone).toBeUndefined(); // never leak the raw phone back
  });

  it("verifyAndGet throws 403 when phone does not match", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any);
    await expect(svc.verifyAndGet("tok123", "0509999999")).rejects.toThrow(AppError);
  });

  it("verifyAndGet throws 404 when token does not exist", async () => {
    const repo = makeRepo(null);
    const svc = createAppointmentLinkService(repo as any);
    await expect(svc.verifyAndGet("bad-token", "0501234567")).rejects.toThrow(AppError);
  });

  it("verifyAndGet throws 410 (gone) when appointment is cancelled/completed/no_show", async () => {
    const repo = makeRepo({ ...ROW, status: "cancelled" });
    const svc = createAppointmentLinkService(repo as any);
    await expect(svc.verifyAndGet("tok123", "0501234567")).rejects.toMatchObject({ statusCode: 410 });
  });

  it("setAttendance confirm updates status=confirmed, customer_confirmed=true, notifies owner", async () => {
    const repo = makeRepo(ROW);
    const notifyOwner = vi.fn().mockResolvedValue(undefined);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: notifyOwner });
    await svc.setAttendance("tok123", "0501234567", "confirm");
    expect(repo.updateAttendance).toHaveBeenCalledWith("apt-1", "confirmed", true);
    expect(notifyOwner).toHaveBeenCalledWith("apt-1", "confirm");
  });

  it("setAttendance reject updates status=cancelled, customer_confirmed=false", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn() });
    await svc.setAttendance("tok123", "0501234567", "reject");
    expect(repo.updateAttendance).toHaveBeenCalledWith("apt-1", "cancelled", false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/appointment-link-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { AppError } from "../../middleware/error-handler";
import type { createAppointmentLinkRepo } from "./appointment-link.repository";

type Repo = ReturnType<typeof createAppointmentLinkRepo>;

const INACTIVE_STATUSES = new Set(["cancelled", "completed", "no_show"]);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

export interface AppointmentLinkSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  startTime: string;
  status: string;
}

type Deps = {
  notifyOwnerOfAttendance: (appointmentId: string, decision: "confirm" | "reject") => Promise<void>;
};

export function createAppointmentLinkService(repo: Repo, deps: Partial<Deps> = {}) {
  const resolvedDeps: Deps = {
    notifyOwnerOfAttendance: deps.notifyOwnerOfAttendance ?? (async () => {}),
  };

  async function loadVerified(token: string, phone: string) {
    const { data } = await repo.getByToken(token);
    if (!data) throw new AppError(404, "Appointment link not found");
    if (normalizePhone(data.customers.phone) !== normalizePhone(phone)) {
      throw new AppError(403, "Phone number does not match this appointment");
    }
    if (INACTIVE_STATUSES.has(data.status)) {
      throw new AppError(410, "This appointment is no longer active");
    }
    return data;
  }

  async function verifyAndGet(token: string, phone: string): Promise<AppointmentLinkSummary> {
    const apt = await loadVerified(token, phone);
    const serviceName = apt.services.name_he;
    return {
      id: apt.id,
      businessId: apt.business_id,
      businessName: apt.businesses.name,
      serviceName,
      startTime: apt.start_time,
      status: apt.status,
    };
  }

  async function setAttendance(token: string, phone: string, decision: "confirm" | "reject") {
    const apt = await loadVerified(token, phone);
    const status = decision === "confirm" ? "confirmed" : "cancelled";
    await repo.updateAttendance(apt.id, status, decision === "confirm");
    await resolvedDeps.notifyOwnerOfAttendance(apt.id, decision);
    return { status };
  }

  return { verifyAndGet, setAttendance, loadVerified };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/appointment-link-service.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/appointments/appointment-link.service.ts apps/api/src/__tests__/appointment-link-service.test.ts
git commit -m "feat(appointments): add appointment-link service (verify, attendance)"
```

---

## Task 5: `change-request.repository.ts`

**Files:**
- Create: `apps/api/src/modules/appointments/change-request.repository.ts`
- Test: `apps/api/src/__tests__/change-request-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChangeRequestRepo } from "../modules/appointments/change-request.repository";

function fakeClient(handlers: Record<string, any>) {
  return { from: vi.fn((table: string) => handlers[table]) } as any;
}

describe("change-request repository", () => {
  it("findPendingByAppointment filters by appointment_id and status=pending", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { select } }));

    await repo.findPendingByAppointment("apt-1");

    expect(eq1).toHaveBeenCalledWith("appointment_id", "apt-1");
    expect(eq2).toHaveBeenCalledWith("status", "pending");
  });

  it("create inserts a row with status=pending and returns it", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "req-1", status: "pending" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { insert } }));

    await repo.create({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" })
    );
  });

  it("updateStatus sets status, resolved_at, resolved_by", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "req-1", status: "approved" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { update } }));

    await repo.updateStatus("req-1", "approved", "user-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", resolved_by: "user-1" })
    );
    expect(eq).toHaveBeenCalledWith("id", "req-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-repository.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type ChangeRequestType = "edit" | "cancel";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequestRow {
  id: string;
  appointment_id: string;
  business_id: string;
  type: ChangeRequestType;
  proposed_start_time: string | null;
  reason: string | null;
  status: ChangeRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const COLUMNS =
  "id, appointment_id, business_id, type, proposed_start_time, reason, status, created_at, resolved_at, resolved_by";

export function createChangeRequestRepo(client: SupabaseClient<Database>) {
  return {
    async findPendingByAppointment(appointmentId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("appointment_id", appointmentId)
        .eq("status", "pending")
        .maybeSingle();
    },

    async create(row: {
      appointment_id: string;
      business_id: string;
      type: ChangeRequestType;
      proposed_start_time?: string | null;
      reason?: string | null;
    }) {
      return client
        .from("appointment_change_requests")
        .insert({ ...row, status: "pending" })
        .select(COLUMNS)
        .single();
    },

    async findByIdAndBusiness(id: string, businessId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("id", id)
        .eq("business_id", businessId)
        .single();
    },

    async updateStatus(id: string, status: "approved" | "rejected", resolvedBy: string) {
      return client
        .from("appointment_change_requests")
        .update({ status, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
        .eq("id", id)
        .select(COLUMNS)
        .single();
    },

    async listPendingByBusiness(businessId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-repository.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/appointments/change-request.repository.ts apps/api/src/__tests__/change-request-repository.test.ts
git commit -m "feat(appointments): add change-request repository"
```

---

## Task 6: `change-request.service.ts` — window gating, create, approve/reject

**Files:**
- Create: `apps/api/src/modules/appointments/change-request.service.ts`
- Test: `apps/api/src/__tests__/change-request-service.test.ts`

Window gating reuses `booking_rules.cancellation_window_minutes` / `reschedule_window_minutes` (already fetched via `apps/api/src/modules/configuration/configuration.repository.ts`). Capacity re-check on edit approval duplicates the overlap-count logic from `appointment.service.ts`'s private `checkSlotCapacity` (that function is closed over `repo` and not exported — see plan research note — so this task reimplements the same overlap query against its own repo rather than importing it).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { AppError } from "../middleware/error-handler";

function makeDeps(overrides: any = {}) {
  return {
    changeRequestRepo: {
      findPendingByAppointment: vi.fn().mockResolvedValue({ data: null, error: null }),
      create: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "pending", type: "cancel" }, error: null }),
      findByIdAndBusiness: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "approved" }, error: null }),
      listPendingByBusiness: vi.fn(),
    },
    getBookingRules: vi.fn().mockResolvedValue({ cancellation_window_minutes: 120, reschedule_window_minutes: 120 }),
    getAppointment: vi.fn().mockResolvedValue({
      id: "apt-1", business_id: "biz-1", service_id: "svc-1", status: "confirmed",
      start_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3h from now
    }),
    checkCapacity: vi.fn().mockResolvedValue(true),
    updateAppointmentTime: vi.fn().mockResolvedValue(undefined),
    cancelAppointment: vi.fn().mockResolvedValue(undefined),
    notifyOwnerOfNewRequest: vi.fn().mockResolvedValue(undefined),
    notifyCustomerOfResolution: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("change-request service", () => {
  it("create() rejects a cancel request inside the cancellation window", async () => {
    const deps = makeDeps({
      getBookingRules: vi.fn().mockResolvedValue({ cancellation_window_minutes: 240, reschedule_window_minutes: 120 }),
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.create("apt-1", { type: "cancel" })).rejects.toThrow(AppError);
  });

  it("create() rejects when a pending request already exists", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findPendingByAppointment: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.create("apt-1", { type: "cancel" })).rejects.toThrow(AppError);
  });

  it("create() succeeds within the window and notifies the owner", async () => {
    const deps = makeDeps();
    const svc = createChangeRequestService(deps as any);
    const result = await svc.create("apt-1", { type: "cancel", reason: "sick" });
    expect(deps.changeRequestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" })
    );
    expect(deps.notifyOwnerOfNewRequest).toHaveBeenCalledWith("req-1");
    expect(result.id).toBe("req-1");
  });

  it("approve() on an edit request re-checks capacity and fails if the slot is taken", async () => {
    const deps = makeDeps({
      checkCapacity: vi.fn().mockResolvedValue(false),
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "edit", status: "pending", proposed_start_time: "2099-01-01T10:00:00Z" },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.approve("biz-1", "req-1", "owner-1")).rejects.toThrow(AppError);
    expect(deps.updateAppointmentTime).not.toHaveBeenCalled();
  });

  it("approve() on an edit request updates the appointment time and notifies the customer", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "edit", status: "pending", proposed_start_time: "2099-01-01T10:00:00Z" },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await svc.approve("biz-1", "req-1", "owner-1");
    expect(deps.updateAppointmentTime).toHaveBeenCalledWith("apt-1", "2099-01-01T10:00:00Z");
    expect(deps.changeRequestRepo.updateStatus).toHaveBeenCalledWith("req-1", "approved", "owner-1");
    expect(deps.notifyCustomerOfResolution).toHaveBeenCalledWith("req-1", "approved");
  });

  it("approve() on a cancel request re-validates the appointment isn't already resolved", async () => {
    const deps = makeDeps({
      getAppointment: vi.fn().mockResolvedValue({ id: "apt-1", business_id: "biz-1", status: "cancelled", start_time: "2099-01-01T10:00:00Z" }),
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "cancel", status: "pending", proposed_start_time: null },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.approve("biz-1", "req-1", "owner-1")).rejects.toThrow(AppError);
    expect(deps.cancelAppointment).not.toHaveBeenCalled();
  });

  it("reject() marks the request rejected and notifies the customer, without touching the appointment", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "cancel", status: "pending", proposed_start_time: null },
          error: null,
        }),
        updateStatus: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "rejected" }, error: null }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await svc.reject("biz-1", "req-1", "owner-1");
    expect(deps.changeRequestRepo.updateStatus).toHaveBeenCalledWith("req-1", "rejected", "owner-1");
    expect(deps.cancelAppointment).not.toHaveBeenCalled();
    expect(deps.updateAppointmentTime).not.toHaveBeenCalled();
    expect(deps.notifyCustomerOfResolution).toHaveBeenCalledWith("req-1", "rejected");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { AppError } from "../../middleware/error-handler";
import type { createChangeRequestRepo, ChangeRequestType } from "./change-request.repository";

type ChangeRequestRepo = ReturnType<typeof createChangeRequestRepo>;

interface BookingRules {
  cancellation_window_minutes: number;
  reschedule_window_minutes: number;
}

interface AppointmentForGating {
  id: string;
  business_id: string;
  service_id?: string;
  status: string;
  start_time: string;
}

export interface ChangeRequestDeps {
  changeRequestRepo: ChangeRequestRepo;
  getBookingRules: (businessId: string) => Promise<BookingRules>;
  getAppointment: (appointmentId: string) => Promise<AppointmentForGating>;
  checkCapacity: (appointmentId: string, proposedStartTime: string) => Promise<boolean>;
  updateAppointmentTime: (appointmentId: string, newStartTime: string) => Promise<void>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  notifyOwnerOfNewRequest: (requestId: string) => Promise<void>;
  notifyCustomerOfResolution: (requestId: string, resolution: "approved" | "rejected") => Promise<void>;
}

function minutesUntil(isoTime: string): number {
  return (new Date(isoTime).getTime() - Date.now()) / 60_000;
}

export function createChangeRequestService(deps: ChangeRequestDeps) {
  async function create(
    appointmentId: string,
    input: { type: ChangeRequestType; proposedStartTime?: string; reason?: string }
  ) {
    const { data: existing } = await deps.changeRequestRepo.findPendingByAppointment(appointmentId);
    if (existing) throw new AppError(409, "You already have a pending request for this appointment");

    const apt = await deps.getAppointment(appointmentId);
    const rules = await deps.getBookingRules(apt.business_id);
    const windowMinutes = input.type === "cancel" ? rules.cancellation_window_minutes : rules.reschedule_window_minutes;
    if (minutesUntil(apt.start_time) < windowMinutes) {
      throw new AppError(400, "Too close to the appointment time to request this change");
    }

    const { data, error } = await deps.changeRequestRepo.create({
      appointment_id: appointmentId,
      business_id: apt.business_id,
      type: input.type,
      proposed_start_time: input.proposedStartTime ?? null,
      reason: input.reason ?? null,
    });
    if (error || !data) throw new AppError(500, "Failed to create change request");

    await deps.notifyOwnerOfNewRequest(data.id);
    return data;
  }

  async function loadPendingRequest(businessId: string, requestId: string) {
    const { data, error } = await deps.changeRequestRepo.findByIdAndBusiness(requestId, businessId);
    if (error || !data) throw new AppError(404, "Change request not found");
    if (data.status !== "pending") throw new AppError(409, "This request has already been resolved");
    return data;
  }

  async function approve(businessId: string, requestId: string, resolvedBy: string) {
    const request = await loadPendingRequest(businessId, requestId);
    const apt = await deps.getAppointment(request.appointment_id);

    if (request.type === "edit") {
      if (!request.proposed_start_time) throw new AppError(400, "Edit request has no proposed time");
      const available = await deps.checkCapacity(request.appointment_id, request.proposed_start_time);
      if (!available) throw new AppError(409, "The proposed slot is no longer available");
      await deps.updateAppointmentTime(request.appointment_id, request.proposed_start_time);
    } else {
      if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") {
        throw new AppError(409, "Appointment is no longer in a cancellable state");
      }
      await deps.cancelAppointment(request.appointment_id);
    }

    await deps.changeRequestRepo.updateStatus(requestId, "approved", resolvedBy);
    await deps.notifyCustomerOfResolution(requestId, "approved");
    return { status: "approved" as const };
  }

  async function reject(businessId: string, requestId: string, resolvedBy: string) {
    await loadPendingRequest(businessId, requestId);
    await deps.changeRequestRepo.updateStatus(requestId, "rejected", resolvedBy);
    await deps.notifyCustomerOfResolution(requestId, "rejected");
    return { status: "rejected" as const };
  }

  return { create, approve, reject };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-service.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/appointments/change-request.service.ts apps/api/src/__tests__/change-request-service.test.ts
git commit -m "feat(appointments): add change-request service (window gating, approve/reject)"
```

---

## Task 7: Wire real deps for `change-request.service.ts`

**Files:**
- Create: `apps/api/src/modules/appointments/change-request.deps.ts`
- Test: none (thin wiring, exercised by the route integration test in Task 9)

This task provides the real `ChangeRequestDeps` implementation (Task 6 tested against mocked deps) — capacity check reimplements the overlap-count query from `appointment.service.ts`'s private `checkSlotCapacity` against the appointments table directly, since that function isn't exported.

- [ ] **Step 1: Write the implementation**

```ts
import { createServiceClient } from "../../lib/supabase";
import { createChangeRequestRepo } from "./change-request.repository";
import type { ChangeRequestDeps } from "./change-request.service";
import { sendChangeRequestOwnerNotification, sendChangeRequestResolutionNotification } from "../../services/notifications";

export function createChangeRequestDeps(): ChangeRequestDeps {
  const supabase = createServiceClient();

  return {
    changeRequestRepo: createChangeRequestRepo(supabase),

    async getBookingRules(businessId) {
      const { data } = await supabase
        .from("booking_rules")
        .select("cancellation_window_minutes, reschedule_window_minutes")
        .eq("business_id", businessId)
        .single();
      return {
        cancellation_window_minutes: data?.cancellation_window_minutes ?? 120,
        reschedule_window_minutes: data?.reschedule_window_minutes ?? 120,
      };
    },

    async getAppointment(appointmentId) {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, business_id, service_id, status, start_time")
        .eq("id", appointmentId)
        .single();
      if (error || !data) throw new Error(`Appointment ${appointmentId} not found`);
      return data;
    },

    async checkCapacity(appointmentId, proposedStartTime) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("business_id, service_id, services(duration_minutes, buffer_minutes, max_capacity)")
        .eq("id", appointmentId)
        .single();
      if (!apt) return false;
      const service = apt.services as unknown as { duration_minutes: number; buffer_minutes: number; max_capacity: number };
      const startDate = new Date(proposedStartTime);
      const endWithBuffer = new Date(startDate.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000);

      const { data: overlapping } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", apt.business_id)
        .eq("service_id", apt.service_id)
        .neq("id", appointmentId)
        .not("status", "in", "(cancelled,no_show)")
        .lt("start_time", endWithBuffer.toISOString())
        .gt("end_time", startDate.toISOString());

      return (overlapping?.length ?? 0) < service.max_capacity;
    },

    async updateAppointmentTime(appointmentId, newStartTime) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("service_id, services(duration_minutes)")
        .eq("id", appointmentId)
        .single();
      const durationMinutes = (apt?.services as unknown as { duration_minutes: number } | undefined)?.duration_minutes ?? 60;
      const endTime = new Date(new Date(newStartTime).getTime() + durationMinutes * 60_000).toISOString();
      await supabase.from("appointments").update({ start_time: newStartTime, end_time: endTime }).eq("id", appointmentId);
    },

    async cancelAppointment(appointmentId) {
      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
    },

    notifyOwnerOfNewRequest: sendChangeRequestOwnerNotification,
    notifyCustomerOfResolution: sendChangeRequestResolutionNotification,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors *after* Task 10 adds `sendChangeRequestOwnerNotification`/`sendChangeRequestResolutionNotification` to `notifications.ts` — if run before that task, this file will fail to typecheck on those two imports; that's expected mid-plan and resolves once Task 10 lands. Do not treat that failure as a regression in this task if Task 10 hasn't run yet.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/appointments/change-request.deps.ts
git commit -m "feat(appointments): wire real dependencies for change-request service"
```

---

## Task 8: Public routes — `public-appointment-link.ts`

**Files:**
- Create: `apps/api/src/routes/public-appointment-link.ts`
- Test: `apps/api/src/__tests__/public-appointment-link-route.test.ts`

Follows the existing public-route pattern from `apps/api/src/routes/appointments.ts` (`POST /` for booking): no `requireAuth`/`requireBusinessAccess` middleware, service-role client used directly since these are genuinely public, unauthenticated endpoints (token + phone are the auth).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

const { mockVerifyAndGet, mockSetAttendance, mockCreate } = vi.hoisted(() => ({
  mockVerifyAndGet: vi.fn(),
  mockSetAttendance: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("../modules/appointments/appointment-link.service", () => ({
  createAppointmentLinkService: () => ({ verifyAndGet: mockVerifyAndGet, setAttendance: mockSetAttendance, loadVerified: vi.fn() }),
}));
vi.mock("../modules/appointments/change-request.service", () => ({
  createChangeRequestService: () => ({ create: mockCreate }),
}));
vi.mock("../modules/appointments/appointment-link.repository", () => ({ createAppointmentLinkRepo: () => ({}) }));
vi.mock("../modules/appointments/change-request.deps", () => ({ createChangeRequestDeps: () => ({}) }));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));

import router from "../routes/public-appointment-link";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public/appointments", router);
  return app;
}

describe("public-appointment-link routes", () => {
  it("POST /:token/verify returns appointment summary on success", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    const res = await request(buildApp()).post("/api/public/appointments/tok123/verify").send({ phone: "0501234567" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("apt-1");
    expect(mockVerifyAndGet).toHaveBeenCalledWith("tok123", "0501234567");
  });

  it("POST /:token/attendance applies the decision", async () => {
    mockSetAttendance.mockResolvedValue({ status: "confirmed" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/attendance")
      .send({ phone: "0501234567", decision: "confirm" });
    expect(res.status).toBe(200);
    expect(mockSetAttendance).toHaveBeenCalledWith("tok123", "0501234567", "confirm");
  });

  it("POST /:token/change-request creates a request after re-verifying phone", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    mockCreate.mockResolvedValue({ id: "req-1", status: "pending" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/change-request")
      .send({ phone: "0501234567", type: "cancel", reason: "sick" });
    expect(res.status).toBe(201);
    expect(mockVerifyAndGet).toHaveBeenCalledWith("tok123", "0501234567");
    expect(mockCreate).toHaveBeenCalledWith("apt-1", { type: "cancel", proposedStartTime: undefined, reason: "sick" });
  });

  it("returns 400 when phone is missing", async () => {
    const res = await request(buildApp()).post("/api/public/appointments/tok123/verify").send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/public-appointment-link-route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { AppError } from "../middleware/error-handler";
import { createServiceClient } from "../lib/supabase";
import { createAppointmentLinkRepo } from "../modules/appointments/appointment-link.repository";
import { createAppointmentLinkService } from "../modules/appointments/appointment-link.service";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { createChangeRequestDeps } from "../modules/appointments/change-request.deps";
import { sendAttendanceOwnerNotification } from "../services/notifications";

const router = Router();

function linkService() {
  const repo = createAppointmentLinkRepo(createServiceClient());
  return createAppointmentLinkService(repo, { notifyOwnerOfAttendance: sendAttendanceOwnerNotification });
}

function requirePhone(req: Request): string {
  const phone = req.body?.phone;
  if (!phone || typeof phone !== "string") throw new AppError(400, "Phone number is required");
  return phone;
}

router.post("/:token/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const summary = await linkService().verifyAndGet(req.params.token, phone);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.post("/:token/attendance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const decision = req.body?.decision;
    if (decision !== "confirm" && decision !== "reject") throw new AppError(400, "decision must be 'confirm' or 'reject'");
    const result = await linkService().setAttendance(req.params.token, phone, decision);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:token/change-request", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const type = req.body?.type;
    if (type !== "edit" && type !== "cancel") throw new AppError(400, "type must be 'edit' or 'cancel'");
    const summary = await linkService().verifyAndGet(req.params.token, phone);
    const changeRequestService = createChangeRequestService(createChangeRequestDeps());
    const result = await changeRequestService.create(summary.id, {
      type,
      proposedStartTime: req.body?.proposedStartTime,
      reason: req.body?.reason,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/public-appointment-link-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/public-appointment-link.ts apps/api/src/__tests__/public-appointment-link-route.test.ts
git commit -m "feat(api): add public appointment-link routes"
```

---

## Task 9: Dashboard routes — `change-requests.ts`

**Files:**
- Create: `apps/api/src/routes/change-requests.ts`
- Test: `apps/api/src/__tests__/change-requests-route.test.ts`

Mirrors the auth pattern from `apps/api/src/routes/whatsapp-credentials.ts`: `requireAuth` + `requireBusinessAccess`, mounted at `/businesses/:businessId/change-requests`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user = { id: "owner-1" }; next(); },
  requireBusinessAccess: (req: any, _res: any, next: any) => { req.businessId = req.params.businessId; next(); },
}));

const { mockListPending, mockApprove, mockReject } = vi.hoisted(() => ({
  mockListPending: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
}));
vi.mock("../modules/appointments/change-request.repository", () => ({
  createChangeRequestRepo: () => ({ listPendingByBusiness: mockListPending }),
}));
vi.mock("../modules/appointments/change-request.service", () => ({
  createChangeRequestService: () => ({ approve: mockApprove, reject: mockReject }),
}));
vi.mock("../modules/appointments/change-request.deps", () => ({ createChangeRequestDeps: () => ({}) }));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));

import router from "../routes/change-requests";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/businesses/:businessId/change-requests", router);
  return app;
}

describe("change-requests dashboard routes", () => {
  it("GET / lists pending requests for the business", async () => {
    mockListPending.mockResolvedValue({ data: [{ id: "req-1", status: "pending" }], error: null });
    const res = await request(buildApp()).get("/api/businesses/biz-1/change-requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockListPending).toHaveBeenCalledWith("biz-1");
  });

  it("POST /:id/approve calls the service with the authenticated user id", async () => {
    mockApprove.mockResolvedValue({ status: "approved" });
    const res = await request(buildApp()).post("/api/businesses/biz-1/change-requests/req-1/approve");
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith("biz-1", "req-1", "owner-1");
  });

  it("POST /:id/reject calls the service with the authenticated user id", async () => {
    mockReject.mockResolvedValue({ status: "rejected" });
    const res = await request(buildApp()).post("/api/businesses/biz-1/change-requests/req-1/reject");
    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith("biz-1", "req-1", "owner-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/change-requests-route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { Router, type Response, type NextFunction } from "express";
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createServiceClient } from "../lib/supabase";
import { createChangeRequestRepo } from "../modules/appointments/change-request.repository";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { createChangeRequestDeps } from "../modules/appointments/change-request.deps";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const repo = createChangeRequestRepo(createServiceClient());
      const { data, error } = await repo.listPendingByBusiness(req.params.businessId);
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/approve",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const service = createChangeRequestService(createChangeRequestDeps());
      const result = await service.approve(req.params.businessId, req.params.id, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/reject",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const service = createChangeRequestService(createChangeRequestDeps());
      const result = await service.reject(req.params.businessId, req.params.id, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/change-requests-route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Mount both new route files in `app.ts`**

Find where `appointments.ts` and `whatsapp-credentials.ts` routers are mounted in `apps/api/src/app.ts` (look for `app.use("/api/businesses/:businessId/appointments", ...)` and similar) and add, following the exact same mounting style:

```ts
import publicAppointmentLinkRoutes from "./routes/public-appointment-link";
import changeRequestsRoutes from "./routes/change-requests";

// alongside the other app.use(...) calls:
app.use("/api/public/appointments", publicAppointmentLinkRoutes);
app.use("/api/businesses/:businessId/change-requests", changeRequestsRoutes);
```

- [ ] **Step 6: Typecheck and run the full backend test suite**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass (existing + new)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/change-requests.ts apps/api/src/__tests__/change-requests-route.test.ts apps/api/src/app.ts
git commit -m "feat(api): add dashboard change-requests routes, mount new routers"
```

---

## Task 10: Notifications — owner + customer messages for requests and attendance

**Files:**
- Modify: `apps/api/src/services/notifications.ts`
- Test: `apps/api/src/__tests__/change-request-notifications.test.ts`

Adds three functions following the existing `sendApprovalNotification`/`sendRejectionNotification` conventions in the same file (fetch via `createServiceClient()`, build vars, `resolveBusinessCredential`, try/catch around the send, always `logNotification`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockSendWhatsAppMessage } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSendWhatsAppMessage: vi.fn().mockResolvedValue("wamid.1"),
}));

vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({ from: mockFrom }) }));
vi.mock("../services/whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/whatsapp")>();
  return { ...actual, sendWhatsAppMessage: mockSendWhatsAppMessage };
});

function chain(data: any) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

describe("change-request notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sendChangeRequestOwnerNotification sends to the business's contact_phone", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "appointment_change_requests") {
        return chain({ id: "req-1", type: "cancel", appointment_id: "apt-1", business_id: "biz-1" });
      }
      if (table === "appointments") {
        return chain({ id: "apt-1", start_time: "2099-01-01T10:00:00Z", customers: { name: "Dana" }, services: { name_he: "תספורת" } });
      }
      if (table === "businesses") {
        return chain({ name: "Studio", contact_phone: "972501111111" });
      }
      return chain(null);
    });
    const { sendChangeRequestOwnerNotification } = await import("../services/notifications");
    await sendChangeRequestOwnerNotification("req-1");
    expect(mockSendWhatsAppMessage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-notifications.test.ts`
Expected: FAIL — `sendChangeRequestOwnerNotification` is not exported

- [ ] **Step 3: Add the three functions to `notifications.ts`**

Add near the bottom of the file, after `sendManagerNotification` (following its existing shape — read the current function before editing so the new code matches its exact query/variable-building style):

```ts
export async function sendChangeRequestOwnerNotification(requestId: string) {
  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("appointment_change_requests")
    .select("id, type, appointment_id, business_id")
    .eq("id", requestId)
    .single();
  if (!request) return;

  const { data: apt } = await supabase
    .from("appointments")
    .select("id, start_time, customers(name), services(name_he)")
    .eq("id", request.appointment_id)
    .single();
  const { data: business } = await supabase
    .from("businesses")
    .select("name, contact_phone")
    .eq("id", request.business_id)
    .single();
  if (!apt || !business?.contact_phone) return;

  const customer = apt.customers as unknown as { name: string };
  const service = apt.services as unknown as { name_he: string };
  const date = new Date(apt.start_time).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
  const time = new Date(apt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" });
  const label = request.type === "cancel" ? "בקשת ביטול" : "בקשת שינוי מועד";
  const body = `📩 ${label} חדשה\n👤 ${customer.name}\n📋 ${service.name_he}\n📅 ${date}\n⏰ ${time}`;

  const credential = await resolveBusinessCredential(request.business_id);
  if (!credential) return;
  await sendWhatsAppMessage(credential, business.contact_phone, body);
}

export async function sendAttendanceOwnerNotification(appointmentId: string, decision: "confirm" | "reject") {
  const supabase = createServiceClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("id, business_id, start_time, customers(name), services(name_he)")
    .eq("id", appointmentId)
    .single();
  if (!apt) return;
  const { data: business } = await supabase
    .from("businesses")
    .select("name, contact_phone")
    .eq("id", apt.business_id)
    .single();
  if (!business?.contact_phone) return;

  const customer = apt.customers as unknown as { name: string };
  const service = apt.services as unknown as { name_he: string };
  const verb = decision === "confirm" ? "אישר/ה הגעה" : "ביטל/ה הגעה";
  const body = `${decision === "confirm" ? "✅" : "❌"} ${customer.name} ${verb} לתור:\n📋 ${service.name_he}`;

  const credential = await resolveBusinessCredential(apt.business_id);
  if (!credential) return;
  await sendWhatsAppMessage(credential, business.contact_phone, body);
}

export async function sendChangeRequestResolutionNotification(requestId: string, resolution: "approved" | "rejected") {
  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("appointment_change_requests")
    .select("id, type, appointment_id, business_id, proposed_start_time")
    .eq("id", requestId)
    .single();
  if (!request) return;

  const { data: apt } = await supabase
    .from("appointments")
    .select("id, customers(id, name, phone, language_preference)")
    .eq("id", request.appointment_id)
    .single();
  if (!apt) return;
  const customer = apt.customers as unknown as { id: string; name: string; phone: string; language_preference: string };
  const lang = customer.language_preference || "he";

  const approvedText: Record<string, string> = {
    he: request.type === "cancel" ? "בקשת הביטול שלך אושרה." : "בקשת שינוי המועד שלך אושרה, התור עודכן.",
    ar: request.type === "cancel" ? "تمت الموافقة على طلب الإلغاء." : "تمت الموافقة على طلب تغيير الموعد.",
    en: request.type === "cancel" ? "Your cancellation request was approved." : "Your reschedule request was approved.",
  };
  const rejectedText: Record<string, string> = {
    he: "בקשתך לא אושרה. ניתן ליצור קשר עם העסק ישירות.",
    ar: "لم تتم الموافقة على طلبك. يرجى التواصل مع العمل مباشرة.",
    en: "Your request wasn't approved. Please contact the business directly.",
  };
  const body = (resolution === "approved" ? approvedText : rejectedText)[lang] ?? approvedText.he;

  const credential = await resolveBusinessCredential(request.business_id);
  if (!credential) return;
  await sendWhatsAppMessage(credential, customer.phone, body);

  await logNotification({
    business_id: request.business_id,
    customer_id: customer.id,
    appointment_id: request.appointment_id,
    type: `change_request_${resolution}`,
    channel: "whatsapp",
    template_id: `change_request_${resolution}`,
    status: "sent",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/change-request-notifications.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Typecheck the whole backend (resolves Task 7's deferred import)**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors — `change-request.deps.ts`'s imports of these three functions now resolve.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/notifications.ts apps/api/src/__tests__/change-request-notifications.test.ts
git commit -m "feat(notifications): add owner/customer notifications for change requests and attendance"
```

---

## Task 11: Remove `sendInteractiveReminder` from the reminder send path

**Files:**
- Modify: `apps/api/src/services/notifications.ts`
- Modify: `apps/api/src/__tests__/reminder-dispatch.test.ts` (update any assertion tied to `isManual`/interactive routing)

**Deployment ordering warning (from the spec):** do not ship this task until the WhatsApp-button template changes (Task 12) are submitted to Meta *and confirmed approved* for every business currently using reminders — otherwise reminders will fail entirely in the gap between "code stopped sending interactive buttons" and "template with button is approved." Land Task 12 first, verify approval in WhatsApp Business Manager, then land this task.

- [ ] **Step 1: Read current state of the reminder branch**

Run: `grep -n "isManual\|useButtons\|useTemplate\|sendInteractiveReminder" apps/api/src/services/notifications.ts`
Expected: shows the `isReminder`/`isManual`/`useTemplate`/`useButtons` block inside `sendAppointmentNotification` (previously restored in PR #18 after the earlier revert — see git history on branch `fix/manual-appointment-whatsapp-notifications`).

- [ ] **Step 2: Update the existing reminder-routing test(s) to expect template-only routing**

Open `apps/api/src/__tests__/reminder-dispatch.test.ts` and update any test asserting `sendInteractiveReminder` is called for non-manual reminders — it should now assert `sendCustomerReminderTemplate` is called for *all* reminders regardless of `created_via`. Write the updated assertion as:

```ts
it("routes all reminders through the Meta template, not interactive buttons, regardless of created_via", async () => {
  // ... existing test setup for a non-manual appointment ...
  await sendAppointmentNotification(appointmentId, "reminder_60m");
  expect(mockSendCustomerReminderTemplate).toHaveBeenCalled();
  expect(mockSendInteractiveReminder).not.toHaveBeenCalled();
});
```

(Match this to whatever mocking scaffolding the existing file already uses for `sendCustomerReminderTemplate`/`sendInteractiveReminder` — do not introduce a second mocking pattern in the same file.)

- [ ] **Step 3: Run to verify it fails against current code**

Run: `cd apps/api && npx vitest run src/__tests__/reminder-dispatch.test.ts`
Expected: FAIL — `sendInteractiveReminder` was called because current code still branches on `isManual`

- [ ] **Step 4: Simplify `sendAppointmentNotification`'s reminder routing**

In `apps/api/src/services/notifications.ts`, replace:

```ts
  const isReminder = templateId.startsWith("reminder_");
  const isManual = apt.created_via === "manual";
  const useTemplate = isReminder && isManual;
  const useButtons = isReminder && !isManual && (options.interactiveReminder !== false);
```

with:

```ts
  const isReminder = templateId.startsWith("reminder_");
  // Every reminder now goes out via the Meta template (URL-button link to
  // the appointment self-service page) regardless of created_via — this
  // works whether or not the customer has an open 24h WhatsApp session,
  // unlike the old interactive quick-reply buttons this replaces.
  const useTemplate = isReminder;
  const useButtons = false;
```

Then remove the now-dead `else if (useButtons)` branch calling `sendInteractiveReminder` a few lines below (keep the `useTemplate` and final `else` freeform branches).

- [ ] **Step 5: Remove the now-unused `sendInteractiveReminder` import if nothing else calls it**

Run: `grep -rn "sendInteractiveReminder" apps/api/src --include="*.ts"`
If the only remaining reference is the export in `whatsapp.ts` itself, remove the import line from `notifications.ts`. Leave the function defined and exported in `whatsapp.ts` (harmless, matches the precedent already set in PR #18 for `sendCustomerReminderTemplate`'s unused-elsewhere pattern) — do not delete the function itself, only the now-unused import.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/reminder-dispatch.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full backend suite**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/notifications.ts apps/api/src/__tests__/reminder-dispatch.test.ts
git commit -m "feat(notifications): route all reminders through the template+link, remove interactive buttons"
```

---

## Task 12: URL button on WhatsApp templates

**Files:**
- Modify: `apps/api/src/services/whatsapp.ts` (`sendCustomerReminderTemplate`, `sendCustomerApprovalTemplate`)
- Modify: `apps/api/src/services/whatsapp-templates.ts` (`TEMPLATE_DEFINITIONS` for the 4 affected templates)
- Test: `apps/api/src/__tests__/whatsapp-templates.test.ts` (extend), `apps/api/src/__tests__/reminder-dispatch.test.ts` (extend for the send-time payload)

Meta template button components use `sub_type: "url"` with a dynamic suffix parameter — same shape already used for `sub_type: "quick_reply"` in `sendManagerNewBookingTemplate`, just a different `sub_type` and a `text`-type parameter instead of `payload`.

- [ ] **Step 1: Extend the template-provisioning test for the button component**

Add to `apps/api/src/__tests__/whatsapp-templates.test.ts`:

```ts
it("appointment_reminder_he and appointment_confirmed_he include a URL button component", () => {
  const reminder = TEMPLATE_DEFINITIONS.find((t) => t.name === "appointment_reminder_he")!;
  const confirmed = TEMPLATE_DEFINITIONS.find((t) => t.name === "appointment_confirmed_he")!;
  expect(reminder.buttonUrl).toBe("https://torup.pandacode.co.il/{{1}}/a/{{2}}");
  expect(confirmed.buttonUrl).toBe("https://torup.pandacode.co.il/{{1}}/a/{{2}}");
});

it("appointment_rejected_he has no button (out of scope per design)", () => {
  const rejected = TEMPLATE_DEFINITIONS.find((t) => t.name === "appointment_rejected_he")!;
  expect(rejected.buttonUrl).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/whatsapp-templates.test.ts`
Expected: FAIL — `buttonUrl` is `undefined` on all definitions (property doesn't exist yet)

- [ ] **Step 3: Add `buttonUrl` to the 4 affected `TEMPLATE_DEFINITIONS` entries**

In `apps/api/src/services/whatsapp-templates.ts`, add an optional field to the `TemplateDefinition` interface and set it on the reminder/confirmed entries:

```ts
export interface TemplateDefinition {
  name: string;
  language: "he" | "ar";
  category: "UTILITY";
  body: string;
  example: string[];
  buttonUrl?: string; // Meta URL-button component target, {{1}}=locale, {{2}}=token
}
```

Set `buttonUrl: "https://torup.pandacode.co.il/{{1}}/a/{{2}}"` on the `appointment_reminder_he`, `appointment_reminder_ar`, `appointment_confirmed_he`, `appointment_confirmed_ar` entries (leave `appointment_rejected_he/ar` unchanged, per the design's explicit scope). Also update `submitTemplate`'s Graph API payload builder to append a button component when `def.buttonUrl` is set:

```ts
components: [
  { type: "BODY", text: def.body, example: { body_text: [def.example] } },
  ...(def.buttonUrl
    ? [{
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "צפייה בתור", url: def.buttonUrl, example: ["he", "a1b2c3d4e5f6"] }],
      }]
    : []),
],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/__tests__/whatsapp-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the send-time button parameter**

Add to `apps/api/src/__tests__/reminder-dispatch.test.ts` (or a new focused test file `apps/api/src/__tests__/whatsapp-send-button.test.ts` if the existing file's scaffolding doesn't fit):

```ts
it("sendCustomerReminderTemplate includes a URL button component with the appointment's locale and token", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) });
  global.fetch = fetchMock as any;
  const { sendCustomerReminderTemplate } = await import("../services/whatsapp");

  await sendCustomerReminderTemplate(
    { phoneNumberId: "pn1", accessToken: "tok" },
    "0501234567",
    { businessName: "Studio", serviceName: "Haircut", date: "30.08.2026", time: "08:00" },
    "he",
    { locale: "he", token: "abc123" }
  );

  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  const buttonComponent = body.template.components.find((c: any) => c.type === "button");
  expect(buttonComponent).toEqual({
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: "he/abc123" }],
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/reminder-dispatch.test.ts` (or the new file)
Expected: FAIL — `sendCustomerReminderTemplate` doesn't accept a 5th argument / no button component sent

- [ ] **Step 7: Update `sendCustomerReminderTemplate` and `sendCustomerApprovalTemplate` to accept and send the link params**

In `apps/api/src/services/whatsapp.ts`, add a 5th parameter and append the button component:

```ts
export async function sendCustomerReminderTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { businessName: string; serviceName: string; date: string; time: string },
  language: string,
  link: { locale: string; token: string }
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_reminder_ar" : "appointment_reminder_he";
  const languageCode = language === "ar" ? "ar" : "he";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Customer reminder template "${templateName}" to: ${to}`, params);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.businessName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: `${link.locale}/${link.token}` }],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;
  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer reminder template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }
  return data.messages?.[0]?.id ?? null;
}
```

Apply the identical change to `sendCustomerApprovalTemplate`:

```ts
export async function sendCustomerApprovalTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { customerName: string; serviceName: string; date: string; time: string },
  language: string,
  link: { locale: string; token: string }
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_confirmed_ar" : "appointment_confirmed_he";
  const languageCode = language === "ar" ? "ar" : "he";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Customer approval template "${templateName}" to: ${to}`, params);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.customerName },
                { type: "text", text: params.serviceName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: `${link.locale}/${link.token}` }],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;
  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer approval template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }
  return data.messages?.[0]?.id ?? null;
}
```

Note: this changes `language.code` from the fixed `"en"` fixed by PR #18 back to `languageCode` — no regression, `languageCode` already equals the correct `he`/`ar` value post-PR #18, this is the same expression, just shown in full here since the function body is being replaced wholesale.

- [ ] **Step 8: Update the two call sites in `notifications.ts` to pass `link`**

`sendAppointmentNotification`'s `useTemplate` branch (reminder) and `sendApprovalNotification`'s Meta-template branch both call these functions — update both call sites to pass `{ locale: lang, token: apt.customer_link_token }` (fetch `customer_link_token` alongside the other appointment columns already being selected in each function — add it to the existing `.select(...)` column list).

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: all pass

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/services/whatsapp.ts apps/api/src/services/whatsapp-templates.ts apps/api/src/services/notifications.ts apps/api/src/__tests__/whatsapp-templates.test.ts apps/api/src/__tests__/reminder-dispatch.test.ts
git commit -m "feat(whatsapp): add URL button (appointment link) to reminder and confirmed templates"
```

- [ ] **Step 11: Resubmit the 4 templates to every connected business — manual step, do not skip**

Run for each business with WhatsApp connected (see Task 8's `backfill-whatsapp-templates.ts` from PR #18):
```bash
cd apps/api && npx tsx scripts/backfill-whatsapp-templates.ts --business-name "<name>" --waba-id <waba-id>
```
Expected: `appointment_reminder_he/ar` and `appointment_confirmed_he/ar` report `created` (a structural button change makes Meta treat this as a new template, not `already_exists`). **Wait for Meta approval in WhatsApp Business Manager before proceeding to Task 11 (the interactive-button removal) in production** — this was already sequenced correctly by placing this task before Task 11 in the plan, but flagging again since it's a hard deployment-ordering requirement from the spec, not just a suggestion.

---

## Task 13: Public appointment page — frontend

**Files:**
- Create: `apps/web/src/app/[locale]/a/[token]/page.tsx`
- Create: `apps/web/src/components/appointment-link/appointment-link-view.tsx`

Styled to match `apps/web/src/components/booking/booking-flow.tsx` (Tailwind utility classes, `rounded-xl`, indigo accent, `next-intl`, RTL via `text-start`). No automated test for this task (no existing frontend test infra for booking-flow.tsx either — matches established project convention) — verified manually per Step 4.

- [ ] **Step 1: Create the page shell**

```tsx
// apps/web/src/app/[locale]/a/[token]/page.tsx
import { AppointmentLinkView } from "@/components/appointment-link/appointment-link-view";

export default async function AppointmentLinkPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AppointmentLinkView token={token} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the client component**

```tsx
// apps/web/src/components/appointment-link/appointment-link-view.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface AppointmentSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  startTime: string;
  status: string;
}

const inputCls =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-start";

export function AppointmentLinkView({ token }: { token: string }) {
  const t = useTranslations("appointmentLink");
  const [phone, setPhone] = useState("");
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const verify = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = await apiFetch<AppointmentSummary>(`/api/public/appointments/${token}/verify`, {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setAppointment(summary);
    } catch {
      setError(t("verifyFailed"));
    } finally {
      setLoading(false);
    }
  };

  const setAttendance = async (decision: "confirm" | "reject") => {
    setLoading(true);
    try {
      await apiFetch(`/api/public/appointments/${token}/attendance`, {
        method: "POST",
        body: JSON.stringify({ phone, decision }),
      });
      setActionDone(decision);
    } catch {
      setError(t("actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-1">{t("title")}</h1>
        <p className="text-sm text-gray-500 mb-4">{t("enterPhone")}</p>
        <input
          className={inputCls}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          onClick={verify}
          disabled={loading || !phone}
          className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {t("continue")}
        </button>
      </div>
    );
  }

  if (actionDone) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-gray-900 font-medium">
          {actionDone === "confirm" ? t("attendanceConfirmed") : t("attendanceRejected")}
        </p>
      </div>
    );
  }

  const date = new Date(appointment.startTime).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
  const time = new Date(appointment.startTime).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="font-semibold text-gray-900">{t("yourAppointment")}</div>
        <div className="text-sm text-gray-500 mt-1">
          {appointment.serviceName} · {date} · {time}
        </div>
        <div className="text-sm text-gray-500">{appointment.businessName}</div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <button
          onClick={() => setAttendance("confirm")}
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {t("iWillAttend")}
        </button>
        <ChangeRequestButtons token={token} phone={phone} appointment={appointment} onError={setError} />
        <button
          onClick={() => setAttendance("reject")}
          disabled={loading}
          className="w-full rounded-lg border border-red-600 text-red-600 py-3 font-medium disabled:opacity-50"
        >
          {t("iWontAttend")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ChangeRequestButtons({
  token,
  phone,
  appointment,
  onError,
}: {
  token: string;
  phone: string;
  appointment: AppointmentSummary;
  onError: (msg: string) => void;
}) {
  const t = useTranslations("appointmentLink");
  const [sent, setSent] = useState<"edit" | "cancel" | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const requestCancel = async () => {
    try {
      await apiFetch(`/api/public/appointments/${token}/change-request`, {
        method: "POST",
        body: JSON.stringify({ phone, type: "cancel" }),
      });
      setSent("cancel");
    } catch (err) {
      onError(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  if (sent) {
    return <p className="text-sm text-gray-500 text-center py-2">{t("requestSent")}</p>;
  }

  if (showPicker) {
    return (
      <DateTimePicker
        businessId={appointment.businessId}
        onSelect={async (slotStart) => {
          try {
            await apiFetch(`/api/public/appointments/${token}/change-request`, {
              method: "POST",
              body: JSON.stringify({ phone, type: "edit", proposedStartTime: slotStart }),
            });
            setSent("edit");
          } catch (err) {
            onError(err instanceof Error ? err.message : t("actionFailed"));
          }
        }}
        onCancel={() => setShowPicker(false)}
      />
    );
  }

  return (
    <>
      <button
        onClick={() => setShowPicker(true)}
        className="w-full rounded-lg border border-indigo-600 text-indigo-600 py-3 font-medium"
      >
        {t("requestChange")}
      </button>
      <button onClick={requestCancel} className="w-full rounded-lg border border-red-600 text-red-600 py-3 font-medium">
        {t("requestCancel")}
      </button>
    </>
  );
}

// Imported at the bottom to keep the primary view readable top-to-bottom.
import { DateTimePicker } from "./date-time-picker";
```

- [ ] **Step 3: Add the `appointmentLink` i18n namespace**

Find the existing translation files (`apps/web/src/messages/he.json`, `ar.json`, `en.json` or similar — check `apps/web/src/i18n` or `messages/` directory for the exact path used by `booking-flow.tsx`'s `useTranslations("booking")` calls) and add an `appointmentLink` namespace with keys: `title`, `enterPhone`, `phonePlaceholder`, `continue`, `verifyFailed`, `actionFailed`, `yourAppointment`, `iWillAttend`, `iWontAttend`, `requestChange`, `requestCancel`, `requestSent`, `attendanceConfirmed`, `attendanceRejected` — Hebrew primary, matching the tone of the existing `booking_confirmation`/`approval` WhatsApp template copy in `notifications.ts` (e.g. `title: "התור שלך"`, `iWillAttend: "✅ אני מגיע/ה"`).

- [ ] **Step 4: Manual verification**

Run the dev server (`pnpm dev` from repo root, or per-app), visit `http://localhost:3000/he/a/<a-real-token-from-staging>` with a staging appointment's token and the matching customer phone. Confirm: wrong phone shows the generic error; correct phone shows the summary + three actions; each action calls its endpoint and shows the expected follow-up state.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/a apps/web/src/components/appointment-link/appointment-link-view.tsx apps/web/src/messages
git commit -m "feat(web): add public appointment self-service page"
```

---

## Task 14: Edit-request date/time picker — frontend

**Files:**
- Create: `apps/web/src/components/appointment-link/date-time-picker.tsx`

Reuses the exact date-grid/slot-grid pattern and `/availability` fetch from `apps/web/src/components/booking/booking-flow.tsx` (state, `handleDateSelect`, slot rendering) — adapted into a standalone two-step component instead of being wired into the full booking wizard's step machine.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/appointment-link/date-time-picker.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
  total_capacity: number;
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateTimePicker({
  businessId,
  onSelect,
  onCancel,
}: {
  businessId: string;
  onSelect: (isoStart: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("appointmentLink");
  const [step, setStep] = useState<"date" | "time">("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return toLocalDateString(d);
  });

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ slots: TimeSlot[] }>(
        `/api/businesses/${businessId}/availability?date=${date}`
      );
      setSlots(result.slots);
      setStep("time");
    } catch {
      setError(t("actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (step === "date") {
    return (
      <div>
        <div className="grid grid-cols-4 gap-2">
          {dates.map((date) => {
            const d = new Date(date + "T12:00:00");
            return (
              <button
                key={date}
                onClick={() => handleDateSelect(date)}
                disabled={loading}
                className="rounded-xl border border-gray-200 bg-white p-2 text-center text-sm hover:border-indigo-400 disabled:opacity-50"
              >
                <div className="text-xs text-gray-400">{d.toLocaleDateString("he-IL", { weekday: "short" })}</div>
                <div className="font-bold text-gray-900">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button onClick={onCancel} className="mt-3 w-full text-sm text-gray-500">
          {t("back") ?? "ביטול"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {slots.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">{t("noSlots") ?? "אין תורים פנויים בתאריך זה"}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
            return (
              <button
                key={slot.start}
                onClick={() => onSelect(slot.start)}
                className="rounded-xl border border-gray-200 bg-white p-2 text-sm hover:border-indigo-400"
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={() => setStep("date")} className="mt-3 w-full text-sm text-gray-500">
        {t("back") ?? "חזרה"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

As part of Task 13 Step 4's manual test, click "בקשת שינוי מועד", confirm the date grid loads, selecting a date fetches and shows slots, selecting a slot submits the edit change-request and returns to the "request sent" state.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/appointment-link/date-time-picker.tsx
git commit -m "feat(web): add date/time picker for appointment edit requests"
```

---

## Task 15: Dashboard "Pending Requests" panel

**Files:**
- Create: `apps/web/src/components/dashboard/pending-requests-panel.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

Mirrors `apps/web/src/components/dashboard/pending-approvals-panel.tsx` exactly (props shape, card layout, motion.div, empty-state pattern) — a sibling panel, not a modification of the existing one (different data: `appointment_change_requests`, not `pending_approval` bookings).

- [ ] **Step 1: Create the panel component**

```tsx
// apps/web/src/components/dashboard/pending-requests-panel.tsx
"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export interface ChangeRequest {
  id: string;
  type: "edit" | "cancel";
  proposed_start_time: string | null;
  reason: string | null;
  created_at: string;
  appointment_id: string;
}

export function PendingRequestsPanel({
  requests,
  loading,
  isRtl,
  onClose,
  onApprove,
  onReject,
}: {
  requests: ChangeRequest[];
  loading: boolean;
  isRtl: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="w-[360px] shrink-0 border-s border-gray-200 bg-white flex flex-col h-full" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="font-semibold text-gray-900">
          {t("pendingRequests") ?? "בקשות ממתינות"} ({requests.length})
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("loading") ?? "טוען..."}</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("noPendingRequests") ?? "אין בקשות ממתינות"}</p>
        ) : (
          requests.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-200 p-3 space-y-2"
            >
              <div className="text-sm font-medium text-gray-900">
                {req.type === "cancel" ? (t("cancelRequest") ?? "בקשת ביטול") : (t("editRequest") ?? "בקשת שינוי מועד")}
              </div>
              {req.proposed_start_time && (
                <div className="text-xs text-gray-500">
                  {new Date(req.proposed_start_time).toLocaleString("he-IL")}
                </div>
              )}
              {req.reason && <div className="text-xs text-gray-500">{req.reason}</div>}
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(req.id)}
                  className="flex-1 rounded-lg bg-indigo-600 text-white text-xs py-2 font-medium"
                >
                  {t("approve")}
                </button>
                <button
                  onClick={() => onReject(req.id)}
                  className="flex-1 rounded-lg border border-red-600 text-red-600 text-xs py-2 font-medium"
                >
                  {t("reject")}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the dashboard page**

In `apps/web/src/app/[locale]/dashboard/page.tsx`, following the exact pattern used for `splitMode`/`splitAppts`/`openSplitMode`/`handleApprove`/`handleReject` (`PendingApprovalsPanel`), add a parallel state/handler set:

```ts
import { PendingRequestsPanel, type ChangeRequest } from "@/components/dashboard/pending-requests-panel";

// alongside existing splitMode/splitAppts state:
const [requestsMode, setRequestsMode] = useState(false);
const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
const [requestsLoading, setRequestsLoading] = useState(false);

const openRequestsMode = async () => {
  if (!businessId) return;
  setRequestsMode(true);
  setRequestsLoading(true);
  try {
    const data = await api<ChangeRequest[]>(`/api/businesses/${businessId}/change-requests`);
    setPendingRequests(data);
  } finally {
    setRequestsLoading(false);
  }
};

const handleApproveRequest = async (id: string) => {
  if (!businessId) return;
  await api(`/api/businesses/${businessId}/change-requests/${id}/approve`, { method: "POST" });
  setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  setRefreshKey((k) => k + 1);
};

const handleRejectRequest = async (id: string) => {
  if (!businessId) return;
  await api(`/api/businesses/${businessId}/change-requests/${id}/reject`, { method: "POST" });
  setPendingRequests((prev) => prev.filter((r) => r.id !== id));
};
```

Add a button that calls `openRequestsMode()` near the existing pending-approvals entry point, and render `<PendingRequestsPanel requests={pendingRequests} loading={requestsLoading} isRtl={isRtl} onClose={() => setRequestsMode(false)} onApprove={handleApproveRequest} onReject={handleRejectRequest} />` alongside the existing `PendingApprovalsPanel` render block when `requestsMode` is true (same flex-layout pattern as the existing panel).

- [ ] **Step 3: Add dashboard i18n keys**

Add `pendingRequests`, `cancelRequest`, `editRequest`, `noPendingRequests` to the `dashboard` namespace in the translation files, alongside the existing `approve`/`reject`/`noPendingApprovals` keys used by `pending-approvals-panel.tsx`.

- [ ] **Step 4: Manual verification**

In the dashboard, submit a cancel request via the public link page (Task 13), open the new Pending Requests panel, confirm it appears, click Approve, confirm the appointment's status updates and a WhatsApp notification is logged (check `notification_log` table or worker logs).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/pending-requests-panel.tsx apps/web/src/app/[locale]/dashboard/page.tsx apps/web/src/messages
git commit -m "feat(web): add dashboard pending-requests panel for edit/cancel approvals"
```

---

## Final verification

- [ ] Run `cd apps/api && npx tsc --noEmit && npx vitest run` — all backend tests pass, no type errors.
- [ ] Run `cd apps/web && npx tsc --noEmit` (or the web app's equivalent typecheck script) — no type errors.
- [ ] Confirm the deployment-ordering requirement from Task 12/11 was followed in whatever order tasks actually shipped: template button changes approved by Meta *before* `sendInteractiveReminder` removal reached production.
- [ ] Manually walk the full lifecycle on staging: receive a reminder with the link button (once Meta approves) → open link → verify phone → confirm attendance (owner notified) → separately, request a cancel → owner approves from dashboard → customer notified → appointment shows cancelled.
