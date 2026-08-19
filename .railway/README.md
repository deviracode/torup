# Railway configuration — torup

This project defines its Railway infrastructure as code in `.railway/railway.ts`
(Railway Infrastructure-as-Code / IaC). It manages the **torup-v2** Railway
project: the public API, the internal worker, the frontend, and the WhatsApp
agent.

```txt
.railway/railway.ts
```

---

## Architecture

| Service | Source dir | Runs | Public domain? |
|---|---|---|---|
| `torup-api` | `apps/api` | Customer-facing Express API (endpoints only) | ✅ yes |
| `torup-worker` | `apps/api` (same image!) | Internal routes `/api/internal/*` + in-process schedulers (reminders 5min, Google Calendar sync 15min) | ❌ **no — private network only** |
| `torup-web` | `apps/web` | Next.js frontend (Railway Docker, not Vercel) | ✅ yes |
| `torup-whatsapp` | `services/whatsapp-agent` | WhatsApp agent — the single Meta-facing webhook receiver (buttons, lists, status updates, free text) | ✅ yes |

`torup-whatsapp` must be publicly reachable: Meta delivers webhooks
(button replies, free text, status updates) directly to it at
`/webhook/:businessId`. `torup-api` does **not** proxy or receive WhatsApp
webhooks — an earlier button-only route there was removed since
`torup-whatsapp` is a full superset of its handling.

The API and worker are **the same codebase and the same Docker image** — they
differ only by the `WORKER_ENABLED` env var (`true` on the worker, unset on the
public API). See `docs/superpowers/specs/2026-08-05-worker-api-split-design.md`.

The worker is **private-only**: no public domain. The whatsapp-agent reaches it
over the private network via a reference variable. **Never generate a public
domain for the worker** (see "Pitfalls").

---

## Prerequisites

- Railway CLI: `brew install railway` (or `railway upgrade --yes`)
- The IaC runner: `pnpm add -D railway` at the workspace root (installs the
  `railway-iac-ts` binary used by `railway config` commands)
- `railway login` from the repo root; verify with `railway whoami`
- The repo must be linked to the Railway project:
  `railway init` (new project) or `railway link` (existing)

---

## Common commands

```bash
# Preview what Railway would change (safe, read-only)
pnpm railway config plan

# Show actual variable values in the plan (not redacted)
pnpm railway config plan --show-values

# Apply the planned changes (interactive)
pnpm railway config apply

# Apply non-interactively (destructive changes need both flags)
pnpm railway config apply --yes --confirm-destructive

# Regenerate the scaffold (WARNING: overwrites railway.ts!)
pnpm railway config init
```

---

## How to deploy the whole stack (fresh project)

1. **Create the project + link:**
   ```bash
   railway init --name <project-name> --workspace Deviracode
   ```
2. **Ensure `.railway/railway.ts` exists** (it's committed in this repo). If it
   was overwritten, restore it from git — do **not** rely on `config init`'s
   scaffold, it only generates a single generic `web` service.
3. **Plan + apply:**
   ```bash
   pnpm railway config plan
   pnpm railway config apply --yes
   ```
4. **Set secret env vars** (not stored in git — see below).
5. **Wait for builds**, then verify (see "Verification").
6. **Commit the config** whenever it changes: `git commit .railway/`.

### Setting env vars

Secrets are declared in `railway.ts` as `preserve()` — the IaC apply does not
overwrite them, and they never land in git. Set their values once per service
after the first apply:

```bash
# Per service, one KEY=VALUE pair per invocation
railway variable set --service torup-api --skip-deploys "SUPABASE_URL=https://..." "SUPABASE_SERVICE_ROLE_KEY=..."
```

Use `--skip-deploys` while still setting up, then trigger deploys when ready
(`railway redeploy --service <name> --from-source -y`).

To copy values from another service/project (e.g. production), fetch them via
the GraphQL API:

```bash
railway api -f query.txt --raw-var projectId=<id> --raw-var environmentId=<id> --raw-var serviceId=<id>
# query.txt:
#   query ServiceVars {
#     variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
#   }
```

### What needs env vars per service

| Service | Required vars |
|---|---|
| `torup-api` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `CORS_ORIGIN`, `APP_URL`, `API_URL` |
| `torup-worker` | same as api + `INTERNAL_SECRET` + `WORKER_ENABLED=true` (WORKER_ENABLED is set in code) |
| `torup-web` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (baked at **build time** via Docker ARG) |
| `torup-whatsapp` | `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `INTERNAL_SECRET`, `API_URL`, `API_INTERNAL_URL` |

Notes:
- WhatsApp per-business send credentials live in the DB (`whatsapp_credentials`
  table), NOT in env. The env vars above are the account-level Meta secrets
  (webhook handshake/signature) plus the agent's legacy global
  `WHATSAPP_ACCESS_TOKEN`.
- `API_URL`/`API_INTERNAL_URL` on the agent are **reference variables** — they
  point at the api/worker private domains automatically (see below).

---

## Reference variables (canvas arrows)

Services that depend on each other should use **reference variables**, which
Railway renders as arrows on the project canvas. Use the raw `${{...}}` string
syntax:

```ts
// ✅ correct — renders an arrow from agent → worker on the canvas
API_INTERNAL_URL: "http://${{torup-worker.RAILWAY_PRIVATE_DOMAIN}}:3001",

// ❌ WRONG — `api.env.X` is a VariableValue object; template-literal
//    interpolation produces "[object Object]" (silent, breaks the value)
API_URL: `http://${api.env.RAILWAY_PRIVATE_DOMAIN}:3001`,
```

Setting a reference variable through the CLI also works:

```bash
railway variable set --service torup-whatsapp "API_INTERNAL_URL=http://\${{torup-worker.RAILWAY_PRIVATE_DOMAIN}}:3001"
```

**Do not** overwrite reference variables with literal values via the CLI —
that silently removes the canvas arrow and hard-codes the domain.

---

## Domains

```bash
# Generate a Railway-provided public domain
railway domain --service torup-api

# List existing domains
railway domain --service torup-api

# Delete a domain (use the domain ID; pass --yes non-interactively)
railway domain delete --service torup-worker <DOMAIN_ID> --yes
```

Domains are **not** managed by IaC (Railway-provided domains are excluded from
`railway.ts`). After generating, other services can reference them:
`"https://${{torup-api.RAILWAY_PUBLIC_DOMAIN}}"`.

---

## Service icons

The IaC DSL does **not** expose service icons (only group icons). Set them via
GraphQL:

```bash
railway api -f /tmp/set-icon.txt --raw-var id=<SERVICE_ID> --raw-var "icon=🗄️"
# set-icon.txt:
#   mutation UpdateIcon($id: String!, $icon: String!) {
#     serviceUpdate(id: $id, input: { icon: $icon }) { id name icon }
#   }
```

Icons used for torup-v2: `torup-api` 🗄️, `torup-worker` ⏰, `torup-web` ▲, `torup-whatsapp` 💬.

---

## Verification

```bash
# Public API: health + internal routes must be ABSENT (404)
curl -s https://<api-domain>/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<api-domain>/api/internal/reminders/tick   # expect 404

# Worker: health + internal routes PRESENT (401 without secret)
curl -s https://<worker-private-or-public>/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<worker>/api/internal/reminders/tick      # expect 401

# Worker: manual tick with secret
curl -s -X POST https://<worker>/api/internal/reminders/tick -H "x-internal-secret: <INTERNAL_SECRET>"

# Worker logs should show:
#   "Worker mode enabled: internal routes + in-process schedulers active"
#   "Reminder scheduler started (every 5 minutes)"
#   "Google Calendar sync scheduler started (every 15 minutes)"
```

---

## Pitfalls (learned the hard way)

1. **`rootDirectory` + Dockerfile = broken builds.** Each app's Dockerfile
   copies monorepo paths (`COPY apps/api/`, `COPY packages/...`), so the build
   context must be the **repo root**. Set `source: github("deviracode/torup")`
   WITHOUT `rootDirectory`, plus
   `build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" }`.
   Setting `rootDirectory: "apps/api"` makes the COPYs fail with
   `"/apps/api": not found`.
2. **`railway config init --force` overwrites your `railway.ts`.** Always
   restore the committed file after regenerating the scaffold.
3. **`preserve()` must be imported** from `railway/iac` or the plan fails with
   "preserve is not defined".
4. **Template-literal references break silently** — see "Reference variables".
5. **Worker must not get a public domain** — it's internal. If one was created
   by accident, delete it (`railway domain delete ... --yes`).
6. **Worker also runs the public routes** (`createApp` mounts everything plus
   internal routes when `WORKER_ENABLED=true`) — that's by design; the worker
   is not exposed publicly.
7. **`railway config plan` from the repo root fails if `.railway/` isn't
   there** — the config lives in the worktree/branch; run it from where the
   file exists.
8. **CLI "Unauthorized" when logged in** may be a local DNS problem, not auth:
   if `railway whoami` works but project commands fail, check that
   `api.railway.com` / `backboard.railway.com` resolve to Cloudflare IPs
   (104.18.x.x), not a router-poisoned answer. Fix: add a `/etc/hosts` entry
   for `api.railway.com` → `104.18.10.246`.
9. **Docker builds need the Next.js public vars at build time.** `NEXT_PUBLIC_*`
   are baked via Docker `ARG`/`ENV` in `apps/web/Dockerfile` — set them as
   service variables BEFORE the first build or rebuild.
10. **`railway api` (GraphQL) returns resolved values** for reference
    variables — you can't tell from the output whether a var is a reference or
    a literal. Use `pnpm railway config plan --show-values` to check for
    `${{...}}` syntax or `«hidden»` markers.

---

## IaC reference

- `pnpm railway config plan` — safe preview, no changes.
- `pnpm railway config apply [--yes] [--confirm-destructive]` — applies the
  config to the linked project + environment.
- Services already managed by a root `railway.json`/`railway.toml` must be
  migrated before IaC can manage them (delete the legacy file first).
- Full DSL reference: https://docs.railway.com/infrastructure-as-code
