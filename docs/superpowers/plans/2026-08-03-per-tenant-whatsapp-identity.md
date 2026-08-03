# Per-Tenant WhatsApp Sender Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each business bring its own WhatsApp Business number, so messages send from the tenant's own number/token and inbound webhooks route to the correct tenant by `phone_number_id`.

**Architecture:** A new `whatsapp_credentials` table (one row per business, deny-all RLS + service-role access, mirroring `google_calendar_tokens`). A layered `whatsapp` module (repository → service) resolves credentials. The existing `services/whatsapp.ts` Meta HTTP adapter is refactored to take a resolved `{ phoneNumberId, accessToken }` credential instead of reading env. Notification/reminder senders thread `businessId` so they can resolve a credential. Inbound webhooks route by `metadata.phone_number_id`. No credential → no send.

**Tech Stack:** TypeScript, Express, Supabase (`@torup/db`), Vitest, Postgres SQL migrations.

## Global Constraints

- Migration files live in `supabase/migrations/`, zero-padded 5-digit prefix; next available is `00026`.
- `Database` type in `@torup/db` is `any` — no generated types to update; repositories type the client as `SupabaseClient<Database>`.
- Repositories are factory functions `createXRepo(client)` returning an object of async methods (pattern: `apps/api/src/modules/appointments/appointment.repository.ts`).
- Services never touch `req` or build SQL; they take a repo, return plain objects or throw `AppError` (pattern: `apps/api/src/modules/google-calendar/google-calendar.service.ts`).
- Controllers never import supabase directly beyond `createServiceClient()`; they call `createXService(createXRepo(createServiceClient()))` (pattern: `apps/api/src/routes/google-calendar.ts`).
- `access_token` must NEVER be returned to the browser. Read endpoints return a masked view only.
- No fallback to env sender: a business with no credential row cannot send; the send path returns `null` and logs, it does not throw.
- Test command (run from `apps/api/`): `npm test` (which runs `vitest run --passWithNoTests`). Single file: `npx vitest run src/__tests__/<file> --root apps/api` from repo root, or `npx vitest run src/__tests__/<file>` from `apps/api/`.
- Commit after every task. Branch is `supabase-migration` (already a feature branch — commit directly).

## File Structure

- `supabase/migrations/00026_whatsapp_credentials.sql` — new table + deny-all RLS.
- `apps/api/src/modules/whatsapp/whatsapp-credentials.repository.ts` — data access (get by business_id, get by phone_number_id, upsert, mark verified) — all service-role.
- `apps/api/src/modules/whatsapp/whatsapp-credentials.service.ts` — resolve-for-send, masked status, save, test-send-then-mark-verified.
- `apps/api/src/services/whatsapp.ts` — MODIFY: each `send*` takes a `WhatsAppCredential` first arg; drop env consts.
- `apps/api/src/services/notifications.ts` — MODIFY: resolve credential from `business_id` and pass to `send*`.
- `apps/api/src/routes/webhooks.ts` — MODIFY: route by `metadata.phone_number_id`; reply-sends use resolved credential.
- `apps/api/src/routes/whatsapp-credentials.ts` — new controller (settings endpoints).
- `apps/api/src/index.ts` — MODIFY: mount the new router.
- Tests alongside in `apps/api/src/__tests__/`.

**RLS note (refinement of spec §1/§4):** The spec described owner UPSERT via the RLS user client. This plan instead follows the established `google_calendar_tokens` precedent: **deny-all RLS + all access via service-role**, with tenant safety enforced by the controller resolving `businessId` from the authenticated user (`getBusinessId` + `requireBusinessAccess` + `requireRole`), never from unvalidated client input. Same isolation guarantee, consistent with the codebase. The `access_token` never reaching the browser is enforced at the service/controller layer via a masked read.

---

### Task 1: Migration — `whatsapp_credentials` table + deny-all RLS

**Files:**
- Create: `supabase/migrations/00026_whatsapp_credentials.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: table `whatsapp_credentials(id, business_id, phone_number_id, access_token, display_phone, verified_at, is_active, created_at, updated_at)` with `business_id` and `phone_number_id` both UNIQUE, index on `phone_number_id`, RLS enabled (deny-all → service-role only).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/00026_whatsapp_credentials.sql`:

```sql
-- 00026_whatsapp_credentials.sql
-- Per-tenant WhatsApp Business sender identity (BYO number).
-- Accessed exclusively via the service role (server-side API), same as
-- google_calendar_tokens. RLS is enabled with no policies, so all direct
-- anon/authenticated client access is denied; the service role bypasses RLS.

CREATE TABLE IF NOT EXISTS whatsapp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  display_phone TEXT,
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_phone_number_id
  ON whatsapp_credentials(phone_number_id);

ALTER TABLE whatsapp_credentials ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration locally**

Run (from repo root): `npx supabase db reset` (or the project's migration-apply command — check `package.json`/README if `supabase` CLI is not the workflow; if a remote-only DB, apply via the Supabase SQL editor or `supabase db push`).
Expected: migration applies with no error; `whatsapp_credentials` exists.

If a local Supabase stack is not available, verify the SQL is syntactically valid by reviewing it against `00015_google_calendar.sql` (same shape) and proceed — the table only needs to exist before integration tests that hit a real DB run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00026_whatsapp_credentials.sql
git commit -m "feat(db): add whatsapp_credentials table for per-tenant WhatsApp identity"
```

---

### Task 2: Credentials repository

**Files:**
- Create: `apps/api/src/modules/whatsapp/whatsapp-credentials.repository.ts`
- Test: `apps/api/src/__tests__/whatsapp-credentials-repository.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient<Database>` from `@torup/db` (service-role client passed in).
- Produces: `createWhatsAppCredentialsRepo(client)` returning:
  - `getByBusinessId(businessId: string): Promise<{ data: CredentialRow | null; error: PostgrestError | null }>`
  - `getByPhoneNumberId(phoneNumberId: string): Promise<{ data: CredentialRow | null; error: PostgrestError | null }>`
  - `upsert(businessId: string, input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null }): Promise<{ data: CredentialRow | null; error: PostgrestError | null }>`
  - `markVerified(businessId: string): Promise<{ error: PostgrestError | null }>`
  - Exported type `CredentialRow = { id: string; business_id: string; phone_number_id: string; access_token: string; display_phone: string | null; verified_at: string | null; is_active: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/whatsapp-credentials-repository.test.ts`. Use a hand-rolled fake Supabase client (chainable), matching how other repo tests stub queries.

```ts
import { describe, it, expect, vi } from "vitest";
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";

function fakeClient(handlers: Record<string, any>) {
  return {
    from: vi.fn((table: string) => handlers[table]),
  } as any;
}

describe("whatsapp-credentials repository", () => {
  it("getByPhoneNumberId queries by phone_number_id and returns the row", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1", business_id: "b1", phone_number_id: "pn1" }, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { select } }));

    const res = await repo.getByPhoneNumberId("pn1");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("phone_number_id", "pn1");
    expect(res.data).toEqual({ id: "c1", business_id: "b1", phone_number_id: "pn1" });
  });

  it("upsert writes business_id + credential fields with onConflict business_id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { upsert } }));

    await repo.upsert("b1", { phoneNumberId: "pn1", accessToken: "tok", displayPhone: "+972..." });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: "b1",
        phone_number_id: "pn1",
        access_token: "tok",
        display_phone: "+972...",
      }),
      { onConflict: "business_id" },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api/`): `npx vitest run src/__tests__/whatsapp-credentials-repository.test.ts`
Expected: FAIL — cannot find module `../modules/whatsapp/whatsapp-credentials.repository`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/whatsapp/whatsapp-credentials.repository.ts`:

```ts
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type CredentialRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token: string;
  display_phone: string | null;
  verified_at: string | null;
  is_active: boolean;
};

type SingleResult = { data: CredentialRow | null; error: PostgrestError | null };

const COLUMNS =
  "id, business_id, phone_number_id, access_token, display_phone, verified_at, is_active" as const;

export function createWhatsAppCredentialsRepo(client: SupabaseClient<Database>) {
  return {
    async getByBusinessId(businessId: string): Promise<SingleResult> {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .single() as any;
    },

    async getByPhoneNumberId(phoneNumberId: string): Promise<SingleResult> {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("phone_number_id", phoneNumberId)
        .single() as any;
    },

    async upsert(
      businessId: string,
      input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null },
    ): Promise<SingleResult> {
      return client
        .from("whatsapp_credentials")
        .upsert(
          {
            business_id: businessId,
            phone_number_id: input.phoneNumberId,
            access_token: input.accessToken,
            display_phone: input.displayPhone ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" },
        )
        .select(COLUMNS)
        .single() as any;
    },

    async markVerified(businessId: string): Promise<{ error: PostgrestError | null }> {
      return client
        .from("whatsapp_credentials")
        .update({ verified_at: new Date().toISOString() })
        .eq("business_id", businessId) as any;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/whatsapp-credentials-repository.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/whatsapp/whatsapp-credentials.repository.ts apps/api/src/__tests__/whatsapp-credentials-repository.test.ts
git commit -m "feat(api): add whatsapp_credentials repository"
```

---

### Task 3: Refactor the WhatsApp adapter to take a credential

**Files:**
- Modify: `apps/api/src/services/whatsapp.ts`
- Test: `apps/api/src/__tests__/whatsapp-adapter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Exported type `WhatsAppCredential = { phoneNumberId: string; accessToken: string }`.
  - Every send function gains `credential: WhatsAppCredential` as its **first** parameter and no longer reads `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`. New signatures:
    - `sendWhatsAppMessage(credential, to, body)`
    - `sendManagerApprovalRequest(credential, to, body, appointmentId)`
    - `sendManagerNewBookingTemplate(credential, to, params, appointmentId)`
    - `sendInteractiveReminder(credential, to, body, language)`
    - `sendCustomerReminderTemplate(credential, to, params, language)`
    - `sendCustomerApprovalTemplate(credential, to, params, language)`
  - The dev-mode short-circuit now triggers when `!credential?.accessToken || !credential?.phoneNumberId` (instead of missing env).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/whatsapp-adapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppMessage, type WhatsAppCredential } from "../services/whatsapp";

const cred: WhatsAppCredential = { phoneNumberId: "PN123", accessToken: "TOK456" };

describe("whatsapp adapter credential injection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.1" }] }),
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the credential's phone_number_id with its token", async () => {
    const id = await sendWhatsAppMessage(cred, "0501234567", "hi");

    expect(id).toBe("wamid.1");
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toContain("/PN123/messages");
    expect((opts.headers as any).Authorization).toBe("Bearer TOK456");
  });

  it("returns null and does not fetch when credential is incomplete", async () => {
    const id = await sendWhatsAppMessage(
      { phoneNumberId: "", accessToken: "" },
      "0501234567",
      "hi",
    );
    expect(id).toBeNull();
    expect(fetch as any).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/whatsapp-adapter.test.ts`
Expected: FAIL — `WhatsAppCredential` not exported / `sendWhatsAppMessage` signature mismatch (it still expects `(to, body)`).

- [ ] **Step 3: Implement — refactor the adapter**

In `apps/api/src/services/whatsapp.ts`:

1. Delete the top-level `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` consts. Keep `WHATSAPP_API_URL`.
2. Add the exported type:

```ts
export type WhatsAppCredential = { phoneNumberId: string; accessToken: string };

function hasCredential(c: WhatsAppCredential | null | undefined): c is WhatsAppCredential {
  return Boolean(c && c.accessToken && c.phoneNumberId);
}
```

3. For **each** send function: add `credential: WhatsAppCredential` as the first parameter; replace the `if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID)` guard with `if (!hasCredential(credential))`; in every `fetch` use `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages` and `Authorization: \`Bearer ${credential.accessToken}\``.

Concretely, `sendWhatsAppMessage` becomes:

```ts
export async function sendWhatsAppMessage(
  credential: WhatsAppCredential,
  to: string,
  body: string
): Promise<string | null> {
  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) To: ${to}, Message: ${body}`);
    return null;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error sending to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  const msgId = data.messages?.[0]?.id ?? null;
  if (!msgId) {
    console.error(`[WhatsApp] No message ID in response to ${to}:`, JSON.stringify(data));
  }
  return msgId;
}
```

Apply the identical transformation to `sendManagerApprovalRequest`, `sendManagerNewBookingTemplate`, `sendInteractiveReminder`, `sendCustomerReminderTemplate`, and `sendCustomerApprovalTemplate` — each gets `credential` as the first param, the `hasCredential(credential)` guard, and `credential.phoneNumberId` / `credential.accessToken` in the fetch. Leave the message-body/template JSON bodies unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/whatsapp-adapter.test.ts`
Expected: PASS.

Then compile-check the whole api package to find every broken call site: `npx tsc --noEmit -p apps/api/tsconfig.json` (from repo root). Expect errors in `notifications.ts` and `webhooks.ts` — those are fixed in Tasks 5 and 6. Do NOT fix them here beyond noting them.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/whatsapp.ts apps/api/src/__tests__/whatsapp-adapter.test.ts
git commit -m "refactor(api): WhatsApp adapter takes a resolved credential instead of env"
```

---

### Task 4: Credentials service (resolve, mask, save, test-send)

**Files:**
- Create: `apps/api/src/modules/whatsapp/whatsapp-credentials.service.ts`
- Test: `apps/api/src/__tests__/whatsapp-credentials-service.test.ts`

**Interfaces:**
- Consumes: a repo shaped like Task 2's `createWhatsAppCredentialsRepo` return; the adapter's `sendWhatsAppMessage` + `WhatsAppCredential` (Task 3).
- Produces: `createWhatsAppCredentialsService(repo, deps?)` returning:
  - `resolveForBusiness(businessId: string): Promise<WhatsAppCredential | null>` — returns `{ phoneNumberId, accessToken }` from the row, or `null` if none/inactive.
  - `status(businessId: string): Promise<{ connected: boolean; displayPhone: string | null; verifiedAt: string | null }>` — masked; never includes the token.
  - `save(businessId, input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null }): Promise<{ connected: true; displayPhone: string | null; verifiedAt: string | null }>` — upserts, returns masked view.
  - `testSend(businessId, to: string): Promise<{ ok: boolean }>` — resolves credential, sends a fixed test message via `deps.sendMessage`; on success calls `repo.markVerified` and returns `{ ok: true }`; throws `AppError(400, ...)` if no credential or the send returns null.
  - `deps` defaults to `{ sendMessage: sendWhatsAppMessage }` for test injection.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/whatsapp-credentials-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";

function repoWith(row: any) {
  return {
    getByBusinessId: vi.fn().mockResolvedValue({ data: row, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: row, error: null }),
    markVerified: vi.fn().mockResolvedValue({ error: null }),
  } as any;
}

describe("whatsapp-credentials service", () => {
  it("resolveForBusiness returns the credential shape", async () => {
    const svc = createWhatsAppCredentialsService(
      repoWith({ phone_number_id: "pn1", access_token: "tok", is_active: true }),
    );
    expect(await svc.resolveForBusiness("b1")).toEqual({ phoneNumberId: "pn1", accessToken: "tok" });
  });

  it("resolveForBusiness returns null when no row", async () => {
    const svc = createWhatsAppCredentialsService(repoWith(null));
    expect(await svc.resolveForBusiness("b1")).toBeNull();
  });

  it("status never leaks the token", async () => {
    const svc = createWhatsAppCredentialsService(
      repoWith({ phone_number_id: "pn1", access_token: "tok", display_phone: "+972", verified_at: null, is_active: true }),
    );
    const out = await svc.status("b1");
    expect(out).toEqual({ connected: true, displayPhone: "+972", verifiedAt: null });
    expect(JSON.stringify(out)).not.toContain("tok");
  });

  it("testSend marks verified on success", async () => {
    const repo = repoWith({ phone_number_id: "pn1", access_token: "tok", is_active: true });
    const sendMessage = vi.fn().mockResolvedValue("wamid.1");
    const svc = createWhatsAppCredentialsService(repo, { sendMessage });
    const res = await svc.testSend("b1", "0501234567");
    expect(res).toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(
      { phoneNumberId: "pn1", accessToken: "tok" },
      "0501234567",
      expect.any(String),
    );
    expect(repo.markVerified).toHaveBeenCalledWith("b1");
  });

  it("testSend throws when no credential", async () => {
    const svc = createWhatsAppCredentialsService(repoWith(null), { sendMessage: vi.fn() });
    await expect(svc.testSend("b1", "05")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/whatsapp-credentials-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/whatsapp/whatsapp-credentials.service.ts`:

```ts
import { AppError } from "../../middleware/error-handler";
import {
  sendWhatsAppMessage,
  type WhatsAppCredential,
} from "../../services/whatsapp";
import type { createWhatsAppCredentialsRepo } from "./whatsapp-credentials.repository";

type Repo = ReturnType<typeof createWhatsAppCredentialsRepo>;
type Deps = { sendMessage: typeof sendWhatsAppMessage };

const TEST_MESSAGE = "בדיקת חיבור WhatsApp — ההגדרה תקינה ✅";

export function createWhatsAppCredentialsService(
  repo: Repo,
  deps: Deps = { sendMessage: sendWhatsAppMessage },
) {
  return {
    async resolveForBusiness(businessId: string): Promise<WhatsAppCredential | null> {
      const { data } = await repo.getByBusinessId(businessId);
      if (!data || !data.is_active || !data.access_token || !data.phone_number_id) {
        return null;
      }
      return { phoneNumberId: data.phone_number_id, accessToken: data.access_token };
    },

    async status(businessId: string) {
      const { data } = await repo.getByBusinessId(businessId);
      return {
        connected: Boolean(data && data.is_active),
        displayPhone: data?.display_phone ?? null,
        verifiedAt: data?.verified_at ?? null,
      };
    },

    async save(
      businessId: string,
      input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null },
    ) {
      const { data, error } = await repo.upsert(businessId, input);
      if (error) throw new AppError(500, "Failed to save WhatsApp credentials");
      return {
        connected: true as const,
        displayPhone: data?.display_phone ?? null,
        verifiedAt: data?.verified_at ?? null,
      };
    },

    async testSend(businessId: string, to: string) {
      const cred = await this.resolveForBusiness(businessId);
      if (!cred) throw new AppError(400, "No WhatsApp number connected for this business");
      const id = await deps.sendMessage(cred, to, TEST_MESSAGE);
      if (!id) throw new AppError(400, "Test message failed — check the token and phone number id");
      await repo.markVerified(businessId);
      return { ok: true as const };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/whatsapp-credentials-service.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/whatsapp/whatsapp-credentials.service.ts apps/api/src/__tests__/whatsapp-credentials-service.test.ts
git commit -m "feat(api): whatsapp credentials service (resolve, mask, save, test-send)"
```

---

### Task 5: Thread credential resolution through notifications

**Files:**
- Modify: `apps/api/src/services/notifications.ts`
- Test: `apps/api/src/__tests__/notifications-credential.test.ts` (new, focused) — plus keep existing notification tests green.

**Interfaces:**
- Consumes: `createWhatsAppCredentialsService(createWhatsAppCredentialsRepo(createServiceClient()))` and its `resolveForBusiness`; the new adapter signatures from Task 3.
- Produces: no new exports. Behaviour: every place that currently calls `sendWhatsAppMessage(to, msg)` (and the interactive/template variants) first resolves the credential for `apt.business_id`; if `null`, it logs `"[WhatsApp] not configured for business <id>"` and skips the send (records nothing sent), otherwise passes the credential.

- [ ] **Step 1: Add a resolver helper and write the failing test**

First read `apps/api/src/services/notifications.ts` and list every call site of `sendWhatsAppMessage`, `sendInteractiveReminder`, `sendCustomerReminderTemplate`, `sendManagerNewBookingTemplate`, `sendManagerApprovalRequest`, and `sendCustomerApprovalTemplate`. Each call site already has a `business_id` in scope (`apt.business_id` / `setting.business_id` / `businessId`).

Create `apps/api/src/__tests__/notifications-credential.test.ts` targeting the helper you will add:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveBusinessCredential } from "../services/notifications";

describe("resolveBusinessCredential", () => {
  it("returns null and logs when the business has no credential", async () => {
    const warn = vi.spyOn(console, "log").mockImplementation(() => {});
    const fakeService = { resolveForBusiness: vi.fn().mockResolvedValue(null) };
    const cred = await resolveBusinessCredential("biz-1", fakeService as any);
    expect(cred).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("biz-1"));
    warn.mockRestore();
  });

  it("returns the credential when present", async () => {
    const fakeService = { resolveForBusiness: vi.fn().mockResolvedValue({ phoneNumberId: "pn", accessToken: "tok" }) };
    const cred = await resolveBusinessCredential("biz-1", fakeService as any);
    expect(cred).toEqual({ phoneNumberId: "pn", accessToken: "tok" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/notifications-credential.test.ts`
Expected: FAIL — `resolveBusinessCredential` not exported.

- [ ] **Step 3: Implement the helper and update every call site**

In `apps/api/src/services/notifications.ts`:

Add imports and the exported helper near the top:

```ts
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";
import type { WhatsAppCredential } from "./whatsapp";

type CredentialService = Pick<
  ReturnType<typeof createWhatsAppCredentialsService>,
  "resolveForBusiness"
>;

export async function resolveBusinessCredential(
  businessId: string,
  service?: CredentialService,
): Promise<WhatsAppCredential | null> {
  const svc =
    service ??
    createWhatsAppCredentialsService(createWhatsAppCredentialsRepo(createServiceClient()));
  const cred = await svc.resolveForBusiness(businessId);
  if (!cred) {
    console.log(`[WhatsApp] not configured for business ${businessId} — skipping send`);
    return null;
  }
  return cred;
}
```

Then, at **each** send call site, resolve first and pass the credential, e.g. the `sendAppointmentNotification` path around line 255:

```ts
const credential = await resolveBusinessCredential(apt.business_id);
let whatsappMessageId: string | null = null;
if (credential) {
  whatsappMessageId = await sendWhatsAppMessage(credential, customer.phone, message);
}
```

Apply the same pattern to every other call site found in Step 1 (approval, rejection, manager, reminder, waitlist). When a credential is `null`, skip the send and leave the "message id" as `null` (the log-write code already tolerates a null id). The `business_id` to resolve is the one already selected in each function's query.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/notifications-credential.test.ts`
Expected: PASS.
Then run the whole suite: `npm test` (from `apps/api/`).
Expected: PASS — existing notification/approval/reminder tests still green. If a pre-existing test called an adapter directly with the old signature, update that test to pass a credential first arg (these are your tests, adjust them to the new interface).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/notifications.ts apps/api/src/__tests__/notifications-credential.test.ts
git commit -m "feat(api): resolve per-tenant WhatsApp credential in notification sends"
```

---

### Task 6: Route inbound webhooks by phone_number_id

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts`
- Test: `apps/api/src/__tests__/webhook-routing.test.ts`

**Interfaces:**
- Consumes: `createWhatsAppCredentialsService(createWhatsAppCredentialsRepo(createServiceClient()))` (`resolveForBusiness` + a new-in-this-task use of `getByPhoneNumberId` via the repo directly); adapter send functions now need a credential.
- Produces: exported `extractPhoneNumberId(body): string | null` helper; webhook handler resolves the tenant credential from `metadata.phone_number_id` and passes it to all reply-sends. Unknown `phone_number_id` → 200 + drop.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/webhook-routing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractPhoneNumberId } from "../routes/webhooks";

describe("extractPhoneNumberId", () => {
  it("reads metadata.phone_number_id from a WhatsApp payload", () => {
    const body = {
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "PN999" }, messages: [] } }] }],
    };
    expect(extractPhoneNumberId(body)).toBe("PN999");
  });

  it("returns null when absent", () => {
    expect(extractPhoneNumberId({})).toBeNull();
    expect(extractPhoneNumberId({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/webhook-routing.test.ts`
Expected: FAIL — `extractPhoneNumberId` not exported.

- [ ] **Step 3: Implement webhook routing**

In `apps/api/src/routes/webhooks.ts`:

1. Add the exported helper:

```ts
export function extractPhoneNumberId(body: any): string | null {
  return body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}
```

2. In the `POST /whatsapp` handler, after `const value = changes?.value;`, resolve the tenant credential once and pass it down:

```ts
const phoneNumberId = extractPhoneNumberId(req.body);
if (!phoneNumberId) return;

const credService = createWhatsAppCredentialsService(
  createWhatsAppCredentialsRepo(createServiceClient()),
);
const credRepo = createWhatsAppCredentialsRepo(createServiceClient());
const { data: credRow } = await credRepo.getByPhoneNumberId(phoneNumberId);
if (!credRow) {
  // Unknown number — ack and drop (200 already sent).
  return;
}
const credential = { phoneNumberId: credRow.phone_number_id, accessToken: credRow.access_token };
const businessId = credRow.business_id;
```

   Add the imports at top:

```ts
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";
```

3. Change `handleManagerResponse` and `handleButtonResponse` to accept `credential` (and `businessId` where the current `businesses.phone` tenant match happened) and pass `credential` as the first arg to every `sendWhatsAppMessage(...)` call inside them. Scope the appointment lookups to `businessId` (`.eq("business_id", businessId)`) so a manager number only acts on its own tenant's appointments. The manager-identity check against `apt.businesses.phone` stays.

   Update the call sites in the loop:

```ts
await handleManagerResponse(credential, businessId, from, appointmentId, action);
// ...
await handleButtonResponse(credential, businessId, from, buttonId);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/webhook-routing.test.ts`
Expected: PASS.
Then `npx tsc --noEmit -p apps/api/tsconfig.json` (from repo root) — expect zero errors now (Tasks 3/5/6 have fixed every adapter call site).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/__tests__/webhook-routing.test.ts
git commit -m "feat(api): route inbound WhatsApp webhooks by phone_number_id"
```

---

### Task 7: Settings controller + mount

**Files:**
- Create: `apps/api/src/routes/whatsapp-credentials.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/whatsapp-credentials-route.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireBusinessAccess`, `requireRole`, `getBusinessId`, `createServiceClient`, `AppError`, and the Task 2/4 repo+service.
- Produces: router mounted at `/api/businesses/:businessId/whatsapp` with:
  - `GET /` → `service.status(businessId)` (masked).
  - `PUT /` → validates body `{ phoneNumberId, accessToken, displayPhone? }`, `service.save(...)`.
  - `POST /test` → validates body `{ to }`, `service.testSend(businessId, to)`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/whatsapp-credentials-route.test.ts`. Follow the existing route-test style (`api.test.ts` / `categories.test.ts`) — spin the express app or mount just this router with mocked middleware. Minimal version mounting the router with stubbed auth:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireBusinessAccess: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const statusMock = vi.fn().mockResolvedValue({ connected: false, displayPhone: null, verifiedAt: null });
const saveMock = vi.fn().mockResolvedValue({ connected: true, displayPhone: "+972", verifiedAt: null });

vi.mock("../modules/whatsapp/whatsapp-credentials.service", () => ({
  createWhatsAppCredentialsService: () => ({ status: statusMock, save: saveMock, testSend: vi.fn() }),
}));
vi.mock("../modules/whatsapp/whatsapp-credentials.repository", () => ({
  createWhatsAppCredentialsRepo: () => ({}),
}));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));

let router: any;
beforeEach(async () => { router = (await import("../routes/whatsapp-credentials")).default; });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/businesses/:businessId/whatsapp", router);
  return a;
}

describe("whatsapp-credentials route", () => {
  it("GET returns masked status", async () => {
    const res = await request(app()).get("/api/businesses/b1/whatsapp");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, displayPhone: null, verifiedAt: null });
  });

  it("PUT rejects missing fields", async () => {
    const res = await request(app()).put("/api/businesses/b1/whatsapp").send({ phoneNumberId: "pn" });
    expect(res.status).toBe(400);
  });

  it("PUT saves and returns masked view (never the token)", async () => {
    const res = await request(app())
      .put("/api/businesses/b1/whatsapp")
      .send({ phoneNumberId: "pn", accessToken: "tok", displayPhone: "+972" });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("tok");
    expect(saveMock).toHaveBeenCalledWith("b1", { phoneNumberId: "pn", accessToken: "tok", displayPhone: "+972" });
  });
});
```

(If `supertest` is not already a dev dependency, check `apps/api/package.json`; the existing route tests reveal the project's HTTP-testing approach — match it. If they call handlers directly instead of via supertest, mirror that and drop the supertest import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/whatsapp-credentials-route.test.ts`
Expected: FAIL — `../routes/whatsapp-credentials` not found.

- [ ] **Step 3: Implement the controller**

Create `apps/api/src/routes/whatsapp-credentials.ts`:

```ts
import { Router, type Response, type NextFunction } from "express";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { getBusinessId } from "../lib/params";
import { createServiceClient } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

function svc() {
  return createWhatsAppCredentialsService(createWhatsAppCredentialsRepo(createServiceClient()));
}

router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await svc().status(getBusinessId(req)));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { phoneNumberId, accessToken, displayPhone } = req.body ?? {};
      if (!phoneNumberId || !accessToken) {
        throw new AppError(400, "phoneNumberId and accessToken are required");
      }
      res.json(await svc().save(getBusinessId(req), { phoneNumberId, accessToken, displayPhone }));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/test",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { to } = req.body ?? {};
      if (!to) throw new AppError(400, "to is required");
      res.json(await svc().testSend(getBusinessId(req), to));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
```

Mount it in `apps/api/src/index.ts` next to the other `/api/businesses/:businessId/...` routers (e.g. after the google-calendar line):

```ts
import whatsappCredentialsRouter from "./routes/whatsapp-credentials";
// ...
app.use("/api/businesses/:businessId/whatsapp", whatsappCredentialsRouter);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/whatsapp-credentials-route.test.ts`
Expected: PASS.
Then full suite `npm test` (from `apps/api/`) and `npx tsc --noEmit -p apps/api/tsconfig.json` — both green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/whatsapp-credentials.ts apps/api/src/index.ts apps/api/src/__tests__/whatsapp-credentials-route.test.ts
git commit -m "feat(api): WhatsApp credentials settings endpoints (status, save, test)"
```

---

### Task 8: Retire env sender + optional backfill note

**Files:**
- Modify: `apps/api/src/services/whatsapp.ts` (confirm no residual env read), `.env.example` if present.
- Create: `scripts/backfill-whatsapp-credentials.md` (a documented one-off SQL, not code).

**Interfaces:**
- Consumes: nothing.
- Produces: documentation + confirmation that `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` are no longer read anywhere as the sender.

- [ ] **Step 1: Verify env sender is fully retired**

Run (from repo root): `grep -rn "WHATSAPP_TOKEN\|WHATSAPP_PHONE_NUMBER_ID" apps/ --include=*.ts`
Expected: zero hits in `apps/api/src` (the only remaining WhatsApp env vars in use are `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` in `webhooks.ts`). If any hit remains, remove it — it is a missed call site.

- [ ] **Step 2: Write the backfill note**

Create `scripts/backfill-whatsapp-credentials.md`:

```markdown
# Backfill: seed WhatsApp credentials for existing tenants

After the BYO WhatsApp migration, tenants cannot send until they connect a number.
To keep a currently-live tenant working at cutover, insert its credentials once,
using the values that previously lived in the platform env (`WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TOKEN`):

\`\`\`sql
INSERT INTO whatsapp_credentials (business_id, phone_number_id, access_token, display_phone, verified_at)
VALUES ('<business-uuid>', '<phone_number_id>', '<permanent_access_token>', '<+972...>', now())
ON CONFLICT (business_id) DO UPDATE
  SET phone_number_id = EXCLUDED.phone_number_id,
      access_token    = EXCLUDED.access_token,
      display_phone   = EXCLUDED.display_phone,
      updated_at      = now();
\`\`\`

Run via the Supabase SQL editor (service role). All other tenants onboard via the
dashboard settings screen.
```

- [ ] **Step 3: Update `.env.example` if it exists**

Run: `test -f apps/api/.env.example && grep -n WHATSAPP apps/api/.env.example || echo "no .env.example"`.
If it exists and lists `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`, remove those two lines (keep `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`) and add a comment: `# WhatsApp sender identity is now per-tenant in whatsapp_credentials (see docs)`.

- [ ] **Step 4: Full verification**

Run (from `apps/api/`): `npm test` and (from repo root) `npx tsc --noEmit -p apps/api/tsconfig.json`.
Expected: all tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-whatsapp-credentials.md apps/api/.env.example
git commit -m "chore(api): retire env WhatsApp sender; document tenant backfill"
```

---

## Self-Review

**Spec coverage:**
- §1 data model → Task 1. ✅
- §2 sending path (adapter takes credential, resolver, no-send-without-cred) → Tasks 3, 4, 5. ✅
- §3 inbound routing by phone_number_id → Task 6. ✅
- §4 onboarding (status/save/test, masked read) → Tasks 4, 7. ✅
- §5 migration/rollout (retire env, no fallback, backfill) → Tasks 5 (skip when null), 8. ✅
- §6 layering scope (module layered, adapter signature-only, notifications threaded only) → Tasks 2/4 layered, Task 3 adapter, Task 5 thread-only. ✅
- Testing section (RLS isolation, masked read, routing, test-send) → covered in Tasks 2/4/6/7; RLS isolation is deny-all (no policy) so the existing service-role-only precedent applies — a dedicated cross-tenant SELECT test is unnecessary because authenticated clients cannot read the table at all.

**Placeholder scan:** No TBD/TODO; every code step has full code. The only "check the project's approach" notes (supertest availability, migration-apply command) are genuine environment branches with a concrete fallback, not deferred work.

**Type consistency:** `WhatsAppCredential = { phoneNumberId, accessToken }` used identically in Tasks 3–7. `CredentialRow` fields (`phone_number_id`, `access_token`, `display_phone`, `verified_at`, `is_active`) consistent between repo (Task 2), service (Task 4), and webhook (Task 6). Service methods `resolveForBusiness` / `status` / `save` / `testSend` referenced consistently by the controller (Task 7) and notifications (Task 5).
