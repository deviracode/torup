# WhatsApp webhook consolidation — design

## Context

Torup has two independent HTTP receivers for Meta WhatsApp webhooks:

- **`torup-api`** (`POST /api/webhooks/whatsapp/:businessId`) — handles only
  interactive button replies (approve/reject/confirm/cancel). Any other
  message type is silently dropped.
- **`torup-whatsapp`** (`POST /webhook/:businessId`, port 3002) — the AI
  agent. Handles buttons, lists, status updates, **and** free text via
  Claude. A full superset of what `torup-api`'s route does.

The in-app WhatsApp settings UI
(`apps/web/src/components/dashboard/whatsapp-settings.tsx:88`) instructs
merchants to paste the `torup-api` URL into their Meta App webhook config.
Because Meta only supports a single webhook URL per app, this means the AI
agent can never receive traffic for any business that follows the
instructions — free-text messages get no AI response, only button flows
work.

Investigation confirmed the agent's receiving end is also broken
independently of Meta config: `torup-whatsapp` has no public Railway domain
in either the staging or production environment (checked via
`railway list_domains` on both), and `.railway/README.md` documents this as
intentional ("no public domain" in the architecture table). There is no
proxy/forward relationship between `torup-api` and `torup-whatsapp` — they
are fully independent services.

**Outcome**: consolidate on `torup-whatsapp` as the single Meta-facing
webhook endpoint, since it's a strict superset of `torup-api`'s handling,
and remove the now-redundant route from `torup-api` rather than maintaining
two receivers in sync.

## Decisions (confirmed with user)

- Remove `torup-api`'s webhook route entirely — no fallback/redirect.
- No migration notice/banner for already-connected merchants; they'll see
  the new URL next time they open WhatsApp settings and must re-paste it
  into Meta themselves.
- Domain generation (`railway domain --service torup-whatsapp`) is a
  mutating, non-IaC-managed action: apply to staging as part of this work;
  get explicit go-ahead before touching production.

## Changes

### 1. `.railway/railway.ts` — Railway IaC

Add a reference-variable env var to the `torup-web` service block, mirroring
the existing `NEXT_PUBLIC_API_URL` pattern:

```ts
NEXT_PUBLIC_WHATSAPP_AGENT_URL: "https://${{torup-whatsapp.RAILWAY_PUBLIC_DOMAIN}}",
```

This resolves automatically once `torup-whatsapp` has a public domain
(generated separately via `railway domain`, not part of the IaC file per
existing project convention — see README "Domains" section).

### 2. `.railway/README.md`

- Update the architecture table: `torup-whatsapp` public domain column
  changes from "❌ no" to "✅ yes", with a short note that Meta must reach it
  directly to deliver free-text messages to the agent.
- Remove `WHATSAPP_VERIFY_TOKEN` from the "required env vars" row for
  `torup-whatsapp` — traced this in `services/whatsapp-agent/src/credentials.ts`;
  the verify token is per-tenant and DB-stored
  (`whatsapp_credentials.verify_token`), never read from env. The doc line
  was stale.

### 3. `apps/web/src/components/dashboard/whatsapp-settings.tsx`

Replace the webhook URL construction:

```ts
// before
const webhookUrl = businessId ? `${API_URL}/api/webhooks/whatsapp/${businessId}` : "";

// after
const WHATSAPP_AGENT_URL = process.env.NEXT_PUBLIC_WHATSAPP_AGENT_URL || "http://localhost:3002";
const webhookUrl = businessId ? `${WHATSAPP_AGENT_URL}/webhook/${businessId}` : "";
```

(`WHATSAPP_AGENT_URL` constant declared alongside the existing `API_URL`
constant at the top of the file, same pattern.)

### 4. `apps/api` cleanup

- Delete `apps/api/src/routes/webhooks.ts` (268 lines) — fully superseded by
  `torup-whatsapp`'s handling.
- Remove the import and mount in `apps/api/src/app.ts`:
  `import webhooksRouter from "./routes/webhooks";` and
  `app.use("/api/webhooks", webhooksRouter);`.
- Delete `apps/api/src/__tests__/webhook-routing.test.ts` (379 lines) — its
  only subject is the deleted route.
- Confirm no other file imports anything from `routes/webhooks.ts`
  (`extractPhoneNumberId` is imported by the test file being deleted; no
  other consumers were found).

## Out of scope

- No changes to `torup-whatsapp`'s own webhook handling logic — it already
  works correctly once reachable.
- No notification/banner mechanism for existing merchants.
- Production domain generation — explicit follow-up step, not part of this
  change.
- The stray root `railway.json` (legacy, pre-IaC config) is unrelated to
  this bug and left untouched.

## Verification

1. `pnpm build` — confirm `@torup/api` and `@torup/web` still build clean
   after the route/test removal and env var changes.
2. `pnpm --filter @torup/api test` — confirm no test references the deleted
   route/file and the suite passes.
3. After generating the staging domain for `torup-whatsapp`:
   `curl` the GET verification-challenge endpoint
   (`/webhook/:businessId?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`)
   against the new staging URL and confirm a 200 + echoed challenge for a
   real business with stored credentials.
4. Manually verify `pnpm railway config plan` (staging) shows the expected
   diff for the new `NEXT_PUBLIC_WHATSAPP_AGENT_URL` reference variable and
   nothing else changes.
