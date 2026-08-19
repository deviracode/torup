# Production cutover: tenant-env architecture → prod

## Context

Branch `torup-tenant-env` (PR #3, 116 commits ahead of `main`) is a major rearchitecture:
3-layer tenant isolation with RLS enforcement, API restructured into
module/repository/service layers, per-tenant encrypted WhatsApp credentials,
worker/API split, auth improvements, super-admin impersonation, and UI
modernization. It runs on **staging** today and must be brought to **production**.

Production runs on the same two platforms as staging: **Supabase** (Torup project,
branch `main` = `xewiqmxzhxlhmgspairk`) and **Railway** (project `torup-v2`,
environment `production`).

### The central finding driving this plan

Production Railway services currently point `SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL` at **`mrhbyvunpilhlcwhrbfl`** — which is the
`deviracode-staging` Supabase project in a *different org* (`datjssjktjcafskzchnt`),
flagged in `docs/ENVIRONMENTS.md` as a wrong/removed target.

**Confirmed:** real production data lives in **`xewiqmxzhxlhmgspairk`**
(Torup `main` branch). So the Railway `SUPABASE_URL` is misconfigured. This
migration therefore has **two coupled cutovers**:
1. Point prod Railway at the correct Supabase project (`xewiqmxzhxlhmgspairk`).
2. Bring `xewiqmxzhxlhmgspairk`'s schema up to the branch (migrations 00025–00030)
   and push its auth config.

**⚠️ Before flipping the Supabase URL, verify `xewiqmxzhxlhmgspairk`
actually holds the real businesses/bookings** — validate it read-only in Step 1
before any mutation. If it turns out the live data is in `mrhbyvunpilhlcwhrbfl`
after all, STOP and re-plan (a data copy between projects would be required —
out of scope here).

### Decisions locked
- **Prod DB target:** `xewiqmxzhxlhmgspairk` (Torup `main`).
- **Code source branch:** keep prod on `torup-tenant-env` for now (apply
  `.railway/railway.ts` as-is; it already hardcodes that branch on every
  service). Merge to `main` later.
- **Execution style:** walk through **live together**. Every read-only check is
  prepared for you; each *mutating* command is handed over one at a time and you
  run every command that writes to production. Production is never mutated
  automatically.

### Current prod Railway env-var audit (read-only, already done)
All four prod services are Online. Var names present per service:
- `torup-api`: ✅ `ENCRYPTION_KEY`, `SUPABASE_*`, `PAYPLUS_*`, Google, `CORS_ORIGIN`,
  `APP_URL`, `API_URL`. Missing only `REDIS_URL` (declared `preserve()`, optional).
- `torup-worker`: ✅ `INTERNAL_SECRET`, `WORKER_ENABLED`, `SUPABASE_*`, Google.
- `torup-whatsapp`: ✅ `ENCRYPTION_KEY`, `WHATSAPP_*`, `INTERNAL_SECRET`,
  `API_URL`, `API_INTERNAL_URL`. Complete.
- `torup-web`: ✅ `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_API_URL`.
  **Missing `NEXT_PUBLIC_WHATSAPP_AGENT_URL`** (new var this branch adds).

Verified consistent (hash-equal):
- `ENCRYPTION_KEY` is **identical** on prod `torup-api` and `torup-whatsapp` ✅
  (required — mismatched keys break WhatsApp credential decryption).
- `INTERNAL_SECRET` is **identical** on prod `torup-worker` and `torup-whatsapp` ✅.

So the secret plumbing is already good. The main work is: DB migrations on
xewiq, the Supabase-URL repoint, one new web var, config push, and redeploys.

---

## Migrations to apply to prod (`xewiqmxzhxlhmgspairk`)

Source of truth is **`packages/db/supabase/migrations/`** (the root
`supabase/migrations/` was emptied on this branch). New since the last shared
baseline (00024):

| File | What it does | Risk notes |
|---|---|---|
| `00025_rls_gap_closure.sql` | Adds RLS policies (customers, subscriptions, notifications_log, service_categories, staff_services); adds an over-broad `Public can read customers` policy | Depends on `get_user_business_ids()`, `is_super_admin()` already existing on prod |
| `00026_whatsapp_credentials.sql` | `CREATE TABLE whatsapp_credentials` (RLS on, no policies → service-role only) | New table, additive |
| `00027_whatsapp_credentials_per_tenant_meta.sql` | Adds `app_secret`, `verify_token` columns | Additive |
| `00028_customer_rpc_and_policy_revoke.sql` | Adds `find_or_create_customer` SECURITY DEFINER RPC; **drops** the open anon customers SELECT policy from 00025 | Net PII-safe; depends on `supported_language` enum |
| `00029_notification_log_system_values.sql` | notification_log system values | Small |
| `00030_add_contact_phone.sql` | `ALTER TABLE businesses ADD COLUMN contact_phone TEXT` (from `main`, renumbered from `00025` during the rebase to avoid colliding with `00025_rls_gap_closure`) | Additive; branch code depends on this column |

**All six are additive or policy-only — no destructive DDL, no data drops.**
But every one assumes the prod baseline already has 00001–00024's objects
(`get_user_business_ids`, `is_super_admin`, `notifications_log`,
`service_categories`, `staff_services`, `subscriptions`, `supported_language`).
Step 2 verifies that baseline before pushing.

---

## Prerequisites / secrets checklist

| Item | Status | Action |
|---|---|---|
| `ENCRYPTION_KEY` on prod api+whatsapp, equal | ✅ present & matching | none |
| `INTERNAL_SECRET` on prod worker+whatsapp, equal | ✅ present & matching | none |
| `NEXT_PUBLIC_WHATSAPP_AGENT_URL` on prod web | ❌ missing | set in Step 5 |
| Prod Railway `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` → xewiq | ❌ points at mrhby | flip in Step 4/5 |
| `packages/db/supabase/.env.production` (PROJECT_REF + `SUPABASE_AUTH_*`) | ❓ gitignored, confirm it exists | create from `.env.production.example` before Step 6 |
| Prod Supabase DB password (for CLI link/push) | you hold it | needed Steps 2 & 6 |
| Prod Supabase anon + service-role keys for xewiq | in Supabase dashboard | needed Step 4 |
| WhatsApp secrets rotated in Meta (were leaked in git history) | ❌ per `scripts/backfill-whatsapp-credentials.md` §5 | do before/at cutover |
| Per-tenant WhatsApp credentials in prod xewiq `whatsapp_credentials` | ❌ empty (new table) | backfill post-migration via dashboard/script |

---

## Runbook (live, step by step)

> Golden rule enforced throughout: before any mutating command, confirm the
> target. For Supabase, `cat supabase/.temp/project-ref`. For Railway, every
> command carries `-e production` explicitly. Each mutating command is handed
> over; you run it.

### Step 0 — Freeze & backup (do first)
- Announce a short maintenance window (optional but recommended).
- **Snapshot prod DB** `xewiqmxzhxlhmgspairk` from the Supabase dashboard
  (Database → Backups → create/confirm a fresh PITR/backup point). Migrations are
  additive, but this is the rollback anchor.
- Record current prod Railway var values you will change (SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL, anon/service keys) so a revert is one command.

### Step 1 — Verify real data lives in `xewiqmxzhxlhmgspairk` (READ-ONLY, gating)
Run (read-only):
```bash
supabase link --project-ref xewiqmxzhxlhmgspairk        # read-only link; prompts DB password
supabase migration list --linked                         # applied migrations on prod
# Spot-check real data (read-only) via dashboard SQL editor or db query:
#   select count(*) from businesses;
#   select count(*) from appointments;
#   select max(created_at) from appointments;
```
- **Gate:** if `businesses`/`appointments` are populated with real, recent rows →
  proceed. If empty → STOP; the live data may be in `mrhbyvunpilhlcwhrbfl` and we
  re-plan.
- Note the highest applied migration number (expect ≤ 00024).

### Step 2 — Confirm migration baseline & dry-run (READ-ONLY)
Still linked to prod. Point the CLI at the branch migrations dir and preview:
```bash
cat supabase/.temp/project-ref            # MUST read xewiqmxzhxlhmgspairk now
supabase migration list --linked          # confirms which of 00025–00030 are missing
supabase db push --linked --dry-run --workdir packages/db/supabase
```
- Read the dry-run output. Confirm only 00025–00030 (whatever's missing) would
  apply and that no unexpected object is referenced that prod lacks.
- If the dry-run errors on a missing dependency (e.g. `get_user_business_ids`),
  STOP — prod baseline is behind staging and needs the intermediate migrations
  first; re-scope before proceeding.

### Step 3 — Apply migrations to prod (MUTATING)
```bash
cat supabase/.temp/project-ref            # re-confirm xewiqmxzhxlhmgspairk
supabase db push --linked --yes --workdir packages/db/supabase
supabase migration list --linked          # verify 00025–00030 now applied
```
- Verify `whatsapp_credentials` exists with `app_secret`/`verify_token` columns,
  and that the open `Public can read customers` policy is **absent** (00028
  dropped it).

### Step 4 — Gather correct xewiq keys for Railway (READ-ONLY)
From the Supabase dashboard for `xewiqmxzhxlhmgspairk` (Settings → API):
- Project URL: `https://xewiqmxzhxlhmgspairk.supabase.co`
- `anon` public key
- `service_role` secret key

### Step 5 — Repoint prod Railway to xewiq + add missing web var (MUTATING)
Use `--skip-deploys` so nothing restarts mid-change; redeploy in Step 7.
```bash
railway status | grep -E 'Environment:'   # or trust the explicit -e production below

# API + worker + whatsapp: point at the correct Supabase project
railway variables -s torup-api -e production --skip-deploys \
  --set "SUPABASE_URL=https://xewiqmxzhxlhmgspairk.supabase.co" \
  --set "SUPABASE_ANON_KEY=<xewiq-anon>" \
  --set "SUPABASE_SERVICE_ROLE_KEY=<xewiq-service-role>"

railway variables -s torup-worker -e production --skip-deploys \
  --set "SUPABASE_URL=https://xewiqmxzhxlhmgspairk.supabase.co" \
  --set "SUPABASE_ANON_KEY=<xewiq-anon>" \
  --set "SUPABASE_SERVICE_ROLE_KEY=<xewiq-service-role>"

railway variables -s torup-whatsapp -e production --skip-deploys \
  --set "SUPABASE_URL=https://xewiqmxzhxlhmgspairk.supabase.co" \
  --set "SUPABASE_SERVICE_ROLE_KEY=<xewiq-service-role>"

# WEB: Supabase public vars are baked at BUILD time (Docker ARG) — must be set
# BEFORE the rebuild in Step 7. Also add the new WhatsApp agent URL var.
railway variables -s torup-web -e production --skip-deploys \
  --set "NEXT_PUBLIC_SUPABASE_URL=https://xewiqmxzhxlhmgspairk.supabase.co" \
  --set "NEXT_PUBLIC_SUPABASE_ANON_KEY=<xewiq-anon>" \
  --set "NEXT_PUBLIC_WHATSAPP_AGENT_URL=https://\${{torup-whatsapp.RAILWAY_PUBLIC_DOMAIN}}"
```
Notes:
- `NEXT_PUBLIC_WHATSAPP_AGENT_URL` uses a **reference variable** (`${{...}}`) —
  keep the literal `${{...}}` syntax; do not expand it (see `.railway/README.md`).
- `torup-whatsapp` prod currently has **no public domain** (Step 7 checks this —
  Meta must reach it). If missing, generate one before relying on the ref var.

### Step 6 — Push Supabase auth config to prod (MUTATING)
Auth `site_url` + redirect URLs must match prod web. `config push` is
all-or-nothing on the auth block, so `.env.production` must be complete.
```bash
ls packages/db/supabase/.env.production   # must exist; else copy .env.production.example and fill
scripts/push-config.sh production          # guarded: prompts to type xewiqmxzhxlhmgspairk
```
Set `SUPABASE_AUTH_SITE_URL` / redirect wildcards in `.env.production` to the prod
web domain (`https://torup-web-production.up.railway.app`, or the real custom
domain if one is in use).

### Step 7 — Apply Railway IaC + redeploy (MUTATING)
`.railway/railway.ts` already targets branch `torup-tenant-env` for every service.
Apply from a checkout of this branch, against the production environment:
```bash
railway environment production            # or ensure IaC applies to prod env
pnpm railway config plan --show-values    # READ-ONLY: confirm branch=torup-tenant-env, ref vars intact
pnpm railway config apply --yes           # add --confirm-destructive only if plan shows destructive + reviewed

# Ensure whatsapp has a public domain for Meta webhooks (if absent):
railway domain -s torup-whatsapp -e production   # lists/creates as needed

# Redeploy each service to pick up new vars + branch (web rebuilds NEXT_PUBLIC_*):
railway redeploy -s torup-web       -e production -y
railway redeploy -s torup-api       -e production -y
railway redeploy -s torup-worker    -e production -y
railway redeploy -s torup-whatsapp  -e production -y
```

### Step 8 — Post-cutover data tasks
- **Rotate leaked WhatsApp secrets in Meta** (access token, app secret, verify
  token) per `scripts/backfill-whatsapp-credentials.md` §5 — they were committed
  to git history. Update `WHATSAPP_*` on prod `torup-whatsapp` after rotating.
- **Backfill per-tenant WhatsApp credentials** into the new prod
  `whatsapp_credentials` table (empty after migration). Preferred: each tenant
  saves via dashboard Settings → WhatsApp (encrypts on save). Bulk alternative:
  the Node script in `scripts/backfill-whatsapp-credentials.md` §3 with
  `ENCRYPTION_KEY` set. Re-register each tenant's Meta webhook to
  `https://<whatsapp-domain>/webhook/<businessId>`.

---

## Verification (end-to-end, after Step 7)

Reference `.railway/README.md` "Verification". Run against prod:
```bash
# Public API up; internal routes ABSENT on api (404)
curl -s https://torup-api-production-2d09.up.railway.app/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://torup-api-production-2d09.up.railway.app/api/internal/reminders/tick   # expect 404

# Worker: internal routes present (401 without secret)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://torup-worker-production.up.railway.app/api/internal/reminders/tick     # expect 401

# Web loads and talks to xewiq Supabase (check browser: login works, dashboard
# lists real prod businesses — confirms the DB repoint took and RLS lets owners in)
```
Functional smoke (manual, in prod web UI):
1. Owner login → dashboard shows their real business + appointments (RLS pass).
2. Super-admin impersonation "View as owner" works and the exit banner clears.
3. Public booking flow creates/reuses a customer (exercises
   `find_or_create_customer` RPC from 00028) with no PII leak.
4. A tenant with backfilled WhatsApp creds receives a reminder / inbound webhook
   end-to-end (worker scheduler + agent decrypt path).
5. Worker logs show: "Worker mode enabled…", "Reminder scheduler started",
   "Google Calendar sync scheduler started".

## Rollback
- **DB:** migrations are additive; if a policy breaks access, drop/adjust the
  offending policy, or restore the Step-0 snapshot.
- **Railway:** revert the changed vars to the recorded `mrhby` values and
  redeploy — instant revert of the data-source flip. (Only safe if mrhby still
  holds a usable copy; treat as emergency-only since real data is xewiq.)

## Open items to confirm before Step 3
- Does `packages/db/supabase/.env.production` exist and is it filled? (gitignored)
- Is there a **custom prod domain** in front of `torup-web-production...` that
  auth `site_url` and `CORS_ORIGIN` should use instead of the railway.app host?
- Confirm the maintenance-window timing / who runs each mutating command.
