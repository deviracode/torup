# Environments: Staging vs Production

This project has **two environments** across **two platforms** (Supabase + Railway). Local development targets **staging only**. Production is off-limits for day-to-day work.

> ⚠️ **Golden rule:** Never run a mutating command against production. Before any `supabase` or `railway` command that writes, verify the active target is **staging**.

---

## Identifiers

### Supabase (project "Torup" = `xewiqmxzhxlhmgspairk`, org `centklbxlxxzgupljsvh`)

Staging is a **Supabase branch** of the Torup project. Each branch is a separate instance with its own credentials.

| Env | Ref | Role | Notes |
|-----|-----|------|-------|
| **production** | `xewiqmxzhxlhmgspairk` | `main` branch — **OFF-LIMITS** | Never target directly |
| **staging** | `vwrsqdfunxmjjtebyxdf` | `staging` branch — **local target** | All local `.env` + CLI point here |

> Unrelated: `mrhbyvunpilhlcwhrbfl` (deviracode-staging, different org) — a wrong target that was removed. Do not use.

### Railway (workspace Deviracode, project `torup-v2` = `195a4a9d-6ee8-4099-bee8-a3339653eb7d`)

| Env | Environment ID | Notes |
|-----|----------------|-------|
| **production** | `ba1d5757-e17d-41cb-86ed-bf1de9ec0e71` | Off-limits |
| **staging** | `3106c2e7-8e40-4ee4-ba14-4efcb5b29e64` | Services on `*-staging.up.railway.app` |

Services (both envs): `torup-web`, `torup-api`, `torup-whatsapp`, `torup-worker`.

---

## Which env am I on? (check first, always)

```bash
# Supabase — shows the linked project ref
cat supabase/.temp/project-ref
#  → vwrsqdfunxmjjtebyxdf  = staging (safe)
#  → xewiqmxzhxlhmgspairk  = PRODUCTION (STOP)

# Railway — shows active project + environment
railway status | grep -E 'Project:|Environment:'
```

---

## Switching environments

### Supabase — switch the linked project

```bash
# → staging (normal working state)
supabase link --project-ref vwrsqdfunxmjjtebyxdf

# → production (only for read-only inspection; avoid)
# supabase link --project-ref xewiqmxzhxlhmgspairk   # DON'T unless explicitly required
```

### Railway — switch the active environment

```bash
railway environment staging      # switch default to staging
railway environment production   # switch default to production (avoid)

# Or scope a single command without switching default:
railway <command> -e staging
```

---

## Common CLI commands per platform + env

All examples assume **staging**. For Railway, `-e staging` is explicit so it's safe even if default drifts. For Supabase, always confirm `project-ref` = `vwrsqdfunxmjjtebyxdf` first.

### Supabase (DB / migrations)

```bash
# Confirm target
cat supabase/.temp/project-ref                       # must be vwrsqdfunxmjjtebyxdf

# List branches of the Torup project
supabase branches list --project-ref xewiqmxzhxlhmgspairk

# Get a branch's credentials (URL, keys, JWT secret) as env output
supabase branches get staging --project-ref xewiqmxzhxlhmgspairk -o env

# Compare local migrations vs remote (staging) — READ ONLY
supabase migration list --linked

# Dry-run a migration push (shows what WOULD apply, no writes)
supabase db push --linked --dry-run

# Apply pending migrations to the linked (staging) DB
supabase db push --linked --yes

# New migration file (imperative workflow — no declarative schemas/ dir)
supabase migration new <name>
```

#### Supabase auth/config (`config.toml`) — one file, per-env values

`packages/db/supabase/config.toml` is a **single, committed** file. Per-environment
values (auth `site_url`, redirect URLs) are **not** hardcoded — they're injected at
push time via `env(...)` interpolation. This avoids maintaining separate staging/prod
config files that drift (which previously leaked the production URL into staging).

Real values live in **gitignored** env files next to `config.toml`; templates are
committed as `.example`:

| File | Committed? | Purpose |
|------|-----------|---------|
| `config.toml` | ✅ yes | Shared config with `env()` placeholders + local-dev defaults |
| `.env.staging` | ❌ ignored | Staging `PROJECT_REF` + `SUPABASE_AUTH_*` values |
| `.env.production` | ❌ ignored | Production values (off-limits by default) |
| `.env.staging.example` | ✅ yes | Template — copy to `.env.staging` |
| `.env.production.example` | ✅ yes | Template — copy to `.env.production` |

**⚠️ `supabase config push` is all-or-nothing on the whole auth block.** Any auth
setting *not* present in `config.toml` gets reset to the CLI default on push (this is
how email confirmations + MFA were accidentally disabled once). Keep every auth
setting you care about explicit in `config.toml`.

Push config per environment (never pushes silently — prod requires typing the ref):

```bash
# First time: create the real env files from templates
cp packages/db/supabase/.env.staging.example    packages/db/supabase/.env.staging
cp packages/db/supabase/.env.production.example  packages/db/supabase/.env.production
# …then fill in the values.

# Push (uses the matching .env.<env>, explicit --project-ref inside)
scripts/push-config.sh staging       # → vwrsqdfunxmjjtebyxdf
scripts/push-config.sh production     # → xewiqmxzhxlhmgspairk (guarded: type ref to confirm)
```

Manual equivalent (if not using the script) — export the vars first so `env()` resolves:

```bash
set -a; source packages/db/supabase/.env.staging; set +a
supabase config push --project-ref "$PROJECT_REF" --workdir packages/db/supabase
```


#### Grant super_admin to a user

Super_admin is `auth.users.raw_user_meta_data->>'role' = 'super_admin'` (read by RLS
`is_super_admin()` and the API auth middleware — nothing else defines it). Use the
script; it verifies the linked ref matches the target env before writing:

```bash
scripts/set-superadmin.sh a@x.com b@y.com          # grant on staging (default)
scripts/set-superadmin.sh --revoke a@x.com         # revoke on staging
scripts/set-superadmin.sh --env production a@x.com # PRODUCTION (guarded: type ref)
```

> Migration source of truth: **`supabase/migrations/`** (root). `packages/db/supabase/migrations/` is stale — ignore it.
> Workflow is **imperative** (no `supabase/schemas/`). Iterate schema with `execute_sql`/`db query`, then `supabase db pull <name> --local --yes` to snapshot into a migration.

### Railway (services / vars / deploys)

```bash
# Confirm target
railway status | grep -E 'Project:|Environment:'     # Environment: staging

# List variables for a service (staging)
railway variables -s torup-api -e staging

# Set variables (use --skip-deploys to avoid immediate redeploy)
railway variables -s torup-api -e staging \
  --set "KEY=value" --set "KEY2=value2" --skip-deploys

# Redeploy a service (picks up new vars)
railway redeploy -s torup-api -e staging -y

# List projects / environments
railway list
railway environment <name>      # interactive switch of default env
```

**Supabase env vars in Railway** (all point to `vwrsqdfunxmjjtebyxdf` on staging):

| Service | Keys |
|---------|------|
| torup-web | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| torup-api | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| torup-whatsapp | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| torup-worker | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## Local `.env` files (all point to Supabase staging)

| File | Keys |
|------|------|
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `apps/api/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `services/whatsapp-agent/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

To repoint local to a different branch: pull creds with `supabase branches get <branch> ... -o env`, update the URL + keys in these three files.

---

## Typical staging workflow

1. `cat supabase/.temp/project-ref` → confirm `vwrsqdfunxmjjtebyxdf`.
2. `railway status` → confirm `Environment: staging`.
3. Make schema changes → `supabase db push --linked --dry-run` → `--yes`.
4. Update Railway vars if needed → `--skip-deploys`.
5. `railway redeploy -s <svc> -e staging -y` for each affected service.
6. `railway status -e staging` → confirm all services Online.
