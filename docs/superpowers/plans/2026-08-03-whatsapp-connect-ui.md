# WhatsApp Connect UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a business owner a dashboard settings screen to connect their own WhatsApp number (paste `phone_number_id` + `access_token`), see connection/verification status, and send a test message — all against the already-built backend endpoints.

**Architecture:** One self-contained React client component (`whatsapp-settings.tsx`) rendered as a new "whatsapp" tab in the existing dashboard settings page. The component uses the app's existing `useApi()` hook (auto auth token, auto-401 handling, error toasts) and `useBusiness()` context (for `businessId`) — so it needs no props. The settings page gains only a tab-type member, a tabs-array entry, and a one-line render. Three locale message files get a `whatsapp` tab-label key.

**Tech Stack:** Next.js (App Router, `[locale]` i18n via next-intl), React client components, TypeScript, Tailwind. No unit-test framework exists in `apps/web` — verification is typecheck + build + manual flow driving.

## Global Constraints

- Backend endpoints (already implemented, do NOT modify): under `/api/businesses/:businessId/whatsapp` —
  - `GET /` → `{ connected: boolean, displayPhone: string | null, verifiedAt: string | null }` (masked; never returns the token).
  - `PUT /` → body `{ phoneNumberId, accessToken, displayPhone? }` → returns the same masked shape.
  - `POST /test` → body `{ to }` → `{ ok: true }` on success (also sets `verifiedAt` server-side); 400 with a message on failure.
- The `access_token` must NEVER be fetched back or rendered from server data. It travels only on `PUT`. Drop it from component state right after a successful save.
- Use the existing `useApi()` hook (`apps/web/src/lib/use-api.ts`) for all calls — NOT `apiFetch` directly. `useApi()` returns an `api<T>(path, options?) => Promise<T | null>` function; it returns `null` (not throws) on error and shows a toast, so callers branch on the result being non-null.
- Get `businessId` from `useBusiness()` (`apps/web/src/components/auth/business-provider.tsx`), which returns `{ businessId: string | null, ... }`. Do not add a `businessId` or `token` prop.
- i18n messages live in `packages/i18n/messages/{he,en,ar}.json`; the settings page reads the `dashboard` namespace via `useTranslations("dashboard")`.
- Web verification commands (run from `apps/web/`): `npm run type-check` (`tsc --noEmit`) and `npm run build` (`next build`). There is no test runner.
- Commit after each task using this repo's commit conventions (`feat(web): ...` — check `git log --oneline -10`).
- Body copy follows the neighboring `gcal` tab's pragmatic inline-Hebrew style; only the tab *label* is translated via message keys.

## Spec Reconciliations (the settings page changed after the spec was written)

The spec assumed the page passed `token` and held `businessId` in local state. The current code (after concurrent work landed) uses `useApi()` and `useBusiness()` instead. This plan reflects the CURRENT code:
- Component takes **no props**; it calls `useApi()` and `useBusiness()` itself.
- Error feedback is **toasts** (what `useApi()` already does), which supersedes the spec's inline-message note — this also resolves the open error-feedback question in the spec's favor of app-consistency.

## File Structure

- `apps/web/src/components/dashboard/whatsapp-settings.tsx` — new self-contained component (status fetch, paste form, save, test-send, three UI states).
- `apps/web/src/app/[locale]/dashboard/settings/page.tsx` — MODIFY: add `"whatsapp"` to `Tab`, add a tabs-array entry, add a one-line render of `<WhatsAppSettings />`.
- `packages/i18n/messages/he.json`, `en.json`, `ar.json` — MODIFY: add a `whatsapp` key under `dashboard`.

---

### Task 1: Add the WhatsApp tab wiring (type, label, render) with an empty component

**Files:**
- Create: `apps/web/src/components/dashboard/whatsapp-settings.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`
- Modify: `packages/i18n/messages/he.json`, `packages/i18n/messages/en.json`, `packages/i18n/messages/ar.json`

**Interfaces:**
- Consumes: `useTranslations("dashboard")` (already imported in the page), `useBusiness()`, `useApi()`.
- Produces: default-exported `WhatsAppSettings` React component (no props). The page renders it under `tab === "whatsapp"`. A `dashboard.whatsapp` message key exists in all three locales.

This task establishes the tab and a minimal rendering component so the wiring is verifiable independently before the full UI logic (Task 2) goes in.

- [ ] **Step 1: Create the minimal component**

Create `apps/web/src/components/dashboard/whatsapp-settings.tsx`:

```tsx
"use client";

export default function WhatsAppSettings() {
  return <div className="space-y-4 max-w-md" data-testid="whatsapp-settings" />;
}
```

- [ ] **Step 2: Add the `whatsapp` label key to all three locale files**

In each of `packages/i18n/messages/he.json`, `en.json`, `ar.json`, add a `whatsapp` key inside the existing `dashboard` object (place it near the other settings-tab labels like `workingHours`/`services`). Use the appropriate translation:
- `he.json`: `"whatsapp": "וואטסאפ"`
- `en.json`: `"whatsapp": "WhatsApp"`
- `ar.json`: `"whatsapp": "واتساب"`

Preserve the file's existing formatting and trailing commas; do not reorder other keys.

- [ ] **Step 3: Wire the tab into the settings page**

In `apps/web/src/app/[locale]/dashboard/settings/page.tsx`:

1. Add the import near the other dashboard-component imports at the top:

```tsx
import WhatsAppSettings from "@/components/dashboard/whatsapp-settings";
```

2. Add `"whatsapp"` to the `Tab` union type (currently line 86):

```tsx
type Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking" | "gcal" | "services" | "whatsapp";
```

3. Add an entry to the `tabs` array (currently ~line 414), after the `gcal` entry:

```tsx
    { key: "whatsapp", label: t("whatsapp") },
```

4. Add the tab body render. Find the closing of the `services` tab block (the last `{tab === "..." && ( ... )}` block in the render) and add, immediately after it:

```tsx
        {tab === "whatsapp" && <WhatsAppSettings />}
```

- [ ] **Step 4: Verify typecheck and build**

Run (from `apps/web/`): `npm run type-check`
Expected: zero errors (new `Tab` member, new import, and `t("whatsapp")` all resolve).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/whatsapp-settings.tsx apps/web/src/app/[locale]/dashboard/settings/page.tsx packages/i18n/messages/he.json packages/i18n/messages/en.json packages/i18n/messages/ar.json
git commit -m "feat(web): add WhatsApp settings tab scaffold"
```

---

### Task 2: Implement the WhatsApp settings component (status, paste form, save, test-send)

**Files:**
- Modify: `apps/web/src/components/dashboard/whatsapp-settings.tsx`

**Interfaces:**
- Consumes: `useApi()` → `api<T>(path, options?): Promise<T | null>`; `useBusiness()` → `{ businessId: string | null }`.
- Backend contract: `GET /api/businesses/${businessId}/whatsapp`, `PUT` (body `{ phoneNumberId, accessToken, displayPhone? }`), `POST /api/businesses/${businessId}/whatsapp/test` (body `{ to }`).
- Produces: the full three-state UI. No new exports beyond the existing default component.

- [ ] **Step 1: Implement the component**

Replace the contents of `apps/web/src/components/dashboard/whatsapp-settings.tsx` with:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/lib/use-api";
import { useBusiness } from "@/components/auth/business-provider";
import { toast } from "sonner";

interface WhatsAppStatus {
  connected: boolean;
  displayPhone: string | null;
  verifiedAt: string | null;
}

const META_MANAGER_URL = "https://business.facebook.com/wa/manage/";

export default function WhatsAppSettings() {
  const api = useApi();
  const { businessId } = useBusiness();

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const res = await api<WhatsAppStatus>(`/api/businesses/${businessId}/whatsapp`);
    if (res) setStatus(res);
    setLoading(false);
  }, [api, businessId]);

  useEffect(() => {
    if (businessId) fetchStatus();
  }, [businessId, fetchStatus]);

  const save = async () => {
    if (!businessId || !phoneNumberId || !accessToken) return;
    setSaving(true);
    const res = await api<WhatsAppStatus>(`/api/businesses/${businessId}/whatsapp`, {
      method: "PUT",
      body: JSON.stringify({
        phoneNumberId,
        accessToken,
        displayPhone: displayPhone || undefined,
      }),
    });
    setSaving(false);
    if (res) {
      setAccessToken(""); // never retain the secret
      setShowToken(false);
      setEditing(false);
      toast.success("מספר הוואטסאפ נשמר");
      fetchStatus();
    }
  };

  const sendTest = async () => {
    if (!businessId || !testTo) return;
    setTesting(true);
    const res = await api<{ ok: boolean }>(`/api/businesses/${businessId}/whatsapp/test`, {
      method: "POST",
      body: JSON.stringify({ to: testTo }),
    });
    setTesting(false);
    if (res?.ok) {
      toast.success("הודעת בדיקה נשלחה — המספר מאומת ✓");
      fetchStatus();
    }
  };

  const pasteForm = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        חבר את מספר הוואטסאפ העסקי שלך כדי שההודעות יישלחו מהמספר שלך. את הפרטים תמצא ב-
        <a href={META_MANAGER_URL} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          WhatsApp Manager של Meta
        </a>
        .
      </p>
      <div>
        <label className="block text-sm font-medium mb-1">Phone Number ID</label>
        <input
          type="text"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder="123456789012345"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Access Token</label>
        <div className="flex gap-2">
          <input
            type={showToken ? "text" : "password"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="EAAG..."
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {showToken ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">מספר לתצוגה (אופציונלי)</label>
        <input
          type="text"
          value={displayPhone}
          onChange={(e) => setDisplayPhone(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="+972..."
        />
      </div>
      <button
        onClick={save}
        disabled={saving || !phoneNumberId || !accessToken}
        className="rounded-md bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "שומר..." : "שמור"}
      </button>
    </div>
  );

  const testRow = (
    <div className="border-t border-gray-200 pt-4 space-y-2">
      <p className="text-xs text-muted-foreground">שלח הודעת בדיקה לאימות החיבור:</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="972501234567"
        />
        <button
          onClick={sendTest}
          disabled={testing || !testTo}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? "שולח..." : "שלח בדיקה"}
        </button>
      </div>
    </div>
  );

  if (loading && !status) {
    return <div className="space-y-4 max-w-md text-sm text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="space-y-4 max-w-md">
      {!status?.connected ? (
        pasteForm
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              {status.verifiedAt ? "מחובר ומאומת ✓" : "מחובר"}
            </span>
            {status.displayPhone && (
              <span className="text-sm text-muted-foreground">{status.displayPhone}</span>
            )}
          </div>

          {status.verifiedAt ? (
            <p className="text-xs text-muted-foreground">
              אומת לאחרונה: {new Date(status.verifiedAt).toLocaleString("he-IL")}
            </p>
          ) : (
            <p className="text-sm text-amber-700">עדיין לא אומת — שלח הודעת בדיקה כדי לוודא שהחיבור עובד.</p>
          )}

          {testRow}

          {editing ? (
            pasteForm
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 underline"
            >
              החלף פרטי התחברות
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run (from `apps/web/`): `npm run type-check`
Expected: zero errors.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual flow verification**

There is no unit-test framework in `apps/web`, so drive the real flow. With the app running (`npm run dev` in `apps/web`, plus the API running) and logged in as a business owner, navigate to Settings → the WhatsApp tab and confirm:
1. **Not connected:** the paste form shows with the Meta help link; Save is disabled until both `phone_number_id` and `access_token` are filled; the token field is masked and the 👁️ toggle reveals/hides it.
2. **Save:** after entering credentials and saving, the view flips to the connected state; a success toast appears; the token field is cleared (re-opening "החלף פרטי התחברות" shows an empty token input, never the stored value).
3. **Unverified → verified:** the "עדיין לא אומת" hint shows; sending a test to a real number succeeds, flips to "מחובר ומאומת ✓" with a timestamp; a deliberately-wrong token surfaces the backend error toast and leaves the state unverified.
4. **Network check:** in browser devtools, confirm the `GET /whatsapp` response body and the rendered DOM never contain the `access_token`.

Record what you observed in the report. If you cannot run the full stack in this environment, state that explicitly and confirm the typecheck + build pass as the automated gate, and that the code paths for each state were verified by reading.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/whatsapp-settings.tsx
git commit -m "feat(web): implement WhatsApp connect UI (status, paste, test-send)"
```

---

## Self-Review

**Spec coverage:**
- §1 component boundary & wiring → Task 1 (tab type, label, render, empty component) + Task 2 (component owns state/handlers). Reconciled: no props; uses `useApi()`/`useBusiness()`. ✅
- §2 internals (status fetch, save clears token, test refetches) → Task 2. ✅
- §3 three UI states (not-connected / connected-unverified / connected-verified) → Task 2's render. ✅
- §4 security (write-only token, dropped after save, never rendered), errors (toasts via `useApi()`), i18n (tab label key; body copy inline per gcal precedent) → Tasks 1 & 2. ✅
- Testing section (typecheck + build + manual flow; no unit framework) → Task 1 Step 4, Task 2 Steps 2–4. ✅

**Placeholder scan:** No TBD/TODO. The manual-verification step is a genuine environment branch (full flow if the stack runs; typecheck+build+code-read otherwise), not deferred work — the automated gate (typecheck+build) is always required.

**Type consistency:** `WhatsAppStatus = { connected, displayPhone, verifiedAt }` matches the backend `GET`/`PUT` response exactly and is used consistently. `api<T>(...)` returns `T | null`, and every call site branches on the non-null result. `useBusiness()` provides `businessId: string | null`, guarded before every call.
