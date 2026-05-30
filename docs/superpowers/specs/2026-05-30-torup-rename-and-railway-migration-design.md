# TorUp: Rename & Railway Migration

## Summary

Rename the entire project from "QueuePro"/"Queue Management"/`@queue` to "TorUp"/`@torup`, and migrate the API and WhatsApp Agent from GCP Cloud Run to Railway. The Next.js web frontend moves to Vercel.

## Current → Target

| Layer | Current | Target |
|-------|---------|--------|
| Workspace scope | `@queue/*` | `@torup/*` |
| Root package name | `queue-management` | `torup` |
| Directory | `QueueManagement/` | `torup/` |
| UI brand name | "QueuePro" | "TorUp" |
| CI service names | `queue-api`, `queue-whatsapp` | `torup-api`, `torup-whatsapp` |
| Supabase project name | "QueuePro" | "TorUp" |
| GitHub repo | (current) | `torup` |

## Deployment Architecture

```
Railway                      Vercel
├── torup-api (port 3001)    └── torup-web (Next.js, port 3000)
└── torup-whatsapp (port 3002)

Supabase (unchanged)
```

- **API** — Express, Railway, port 3001. env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV`
- **WhatsApp Agent** — Express, Railway, port 3002. env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NODE_ENV`
- **Web** — Next.js, Vercel. Build-time env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (→ Railway API URL)

## Files to Change

### Rename `@queue` → `@torup`

- `package.json` (root) — name field
- `apps/api/package.json` — name + workspace deps
- `apps/web/package.json` — name + workspace deps
- `services/whatsapp-agent/package.json` — name + workspace deps
- `packages/shared/package.json`
- `packages/db/package.json`
- `packages/i18n/package.json`
- `packages/ui/package.json`
- `Dockerfile` × 3 — COPY paths, `--filter=@queue/*`, `rm -rf node_modules/@queue`, workspace symlink paths
- `pnpm-workspace.yaml` — no changes needed (glob-based), but `pnpm-lock.yaml` re-generated

### Rename "QueuePro" → "TorUp"

- `apps/web/src/app/[locale]/layout.tsx` — metadata title/description
- `apps/web/src/app/[locale]/page.tsx` — footer copyright
- `apps/web/src/app/[locale]/admin/layout.tsx` — admin header
- `apps/web/src/app/[locale]/(auth)/login/page.tsx` — CardTitle
- `apps/web/src/app/[locale]/(auth)/register/page.tsx` — CardTitle
- `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` — CardTitle
- `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` — CardTitle
- `apps/web/src/components/dashboard/sidebar.tsx` — brand name × 3

### CI/CD Rewrite

- `.github/workflows/ci.yml` — remove `deploy-api` and `deploy-whatsapp` GCP jobs; add Railway deploy; update `deploy-web` Vercel job with new env vars

### Files to Delete

- `cloudbuild-api.yaml`
- `cloudbuild-web.yaml`
- `cloudbuild-whatsapp.yaml`
- `.gcloudignore`

### Permissions Config

- `.claude/settings.local.json` — update `@queue/*` references to `@torup/*`

## Migration Sequence

### Phase 1: Rename (no deploy changes)

1. Rename directory `QueueManagement/` → `torup/`
2. Replace `@queue/*` → `@torup/*` in all `package.json` files
3. Update Dockerfiles, `pnpm-workspace.yaml`
4. Replace "QueuePro" → "TorUp" in all `.tsx` files
5. Run `pnpm install` to regenerate lockfile
6. Run full test suite + type check + build
7. Commit on a feature branch

### Phase 2: Rewire CI/CD

1. Rewrite `.github/workflows/ci.yml` — remove GCP, add Railway + updated Vercel
2. Delete `cloudbuild-*.yaml`, `.gcloudignore`
3. Update `.claude/settings.local.json`

### Phase 3: Provision & Deploy

1. Create Railway project with services for API and WhatsApp Agent
2. Set Railway env vars
3. Update/re-link Vercel project with new env vars
4. Rename Supabase project to "TorUp"
5. Rename GitHub repo to `torup`
6. Merge feature branch → CI deploys all three

### Phase 4: Tear Down GCP

1. Delete GCP Cloud Run services
2. Remove GCP secrets from GitHub repo settings

## Risks & Mitigations

- **pnpm lockfile regeneration** — run `pnpm install` after rename, verify no diff in resolved dependencies beyond name changes
- **Supabase project rename** — purely cosmetic in Supabase dashboard, no API impact
- **Vercel project reconnect** — if Vercel project is recreated, DNS/production URL may change; prefer updating existing project
- **Railway cold starts** — acceptable for low-traffic API; upgrade plan if needed
