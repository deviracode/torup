# TorUp Rename & Railway Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the entire codebase from `@queue`/QueuePro to `@torup`/TorUp and migrate API + WhatsApp Agent from GCP Cloud Run to Railway (web to Vercel).

**Architecture:** Monorepo with pnpm workspaces and Turborepo. 3 services: Express API (`apps/api`, port 3001), Next.js web (`apps/web`, port 3000), WhatsApp Agent (`services/whatsapp-agent`, port 3002). API + WhatsApp → Railway. Web → Vercel. Supabase unchanged.

**Tech Stack:** TypeScript, Node.js 20, pnpm 10, Turborepo, Express, Next.js, esbuild, Docker

---

### Task 1: Rename workspace packages — @queue → @torup (package.json files)

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `services/whatsapp-agent/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/db/package.json`
- Modify: `packages/i18n/package.json`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Rename root package.json**

In `package.json`, change `"name": "queue-management"` to `"name": "torup"`.

- [ ] **Step 2: Rename apps/api/package.json**

Change `"name": "@queue/api"` to `"name": "@torup/api"`.
Change dependencies `"@queue/db": "workspace:*"` to `"@torup/db": "workspace:*"`.
Change dependencies `"@queue/shared": "workspace:*"` to `"@torup/shared": "workspace:*"`.

- [ ] **Step 3: Rename apps/web/package.json**

Change `"name": "@queue/web"` to `"name": "@torup/web"`.
Change dependencies `"@queue/db"`, `"@queue/i18n"`, `"@queue/shared"`, `"@queue/ui"` — replace `@queue` with `@torup` in all four.

- [ ] **Step 4: Rename services/whatsapp-agent/package.json**

Change `"name": "@queue/whatsapp-agent"` to `"name": "@torup/whatsapp-agent"`.
Change dependencies `"@queue/db"` and `"@queue/shared"` to `"@torup/db"` and `"@torup/shared"`.

- [ ] **Step 5: Rename packages/shared/package.json**

Change `"name": "@queue/shared"` to `"name": "@torup/shared"`.

- [ ] **Step 6: Rename packages/db/package.json**

Change `"name": "@queue/db"` to `"name": "@torup/db"`.

- [ ] **Step 7: Rename packages/i18n/package.json**

Change `"name": "@queue/i18n"` to `"name": "@torup/i18n"`.

- [ ] **Step 8: Rename packages/ui/package.json**

Change `"name": "@queue/ui"` to `"name": "@torup/ui"`.

- [ ] **Step 9: Commit**

```bash
git add package.json apps/api/package.json apps/web/package.json services/whatsapp-agent/package.json packages/shared/package.json packages/db/package.json packages/i18n/package.json packages/ui/package.json
git commit -m "chore: rename workspace packages @queue -> @torup"
```

---

### Task 2: Update Dockerfiles for new workspace names

**Files:**
- Modify: `apps/api/Dockerfile`
- Modify: `apps/web/Dockerfile`
- Modify: `services/whatsapp-agent/Dockerfile`

- [ ] **Step 1: Update apps/api/Dockerfile**

Lines 11, 22-24, 26, 41 — replace every `@queue` with `@torup`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/api...

WORKDIR /app/apps/api
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
```

- [ ] **Step 2: Update apps/web/Dockerfile**

Line 13 — replace `@queue/web` with `@torup/web`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/web...
```

- [ ] **Step 3: Update services/whatsapp-agent/Dockerfile**

Lines 11, 20-24, 26, 36 — replace every `@queue` with `@torup`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/whatsapp-agent...

WORKDIR /app/services/whatsapp-agent
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile services/whatsapp-agent/Dockerfile
git commit -m "chore: update Dockerfiles for @torup workspace names"
```

---

### Task 3: Rename UI branding — QueuePro → TorUp

**Files:**
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Update layout metadata**

In `apps/web/src/app/[locale]/layout.tsx`, line 9-10:

```tsx
export const metadata: Metadata = {
  title: "TorUp - Smart Appointment Management",
  description: "AI-powered appointment and queue management for businesses",
};
```

- [ ] **Step 2: Update landing page footer**

In `apps/web/src/app/[locale]/page.tsx`, line 76:

```tsx
<span>&copy; {new Date().getFullYear()} TorUp</span>
```

- [ ] **Step 3: Update admin header**

In `apps/web/src/app/[locale]/admin/layout.tsx`, line 25:

```tsx
<h1 className="text-xl font-bold text-primary">TorUp Admin</h1>
```

- [ ] **Step 4: Update auth pages (4 files)**

In each of these files, change the CardTitle from "QueuePro" to "TorUp":

`apps/web/src/app/[locale]/(auth)/login/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/register/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`, line 59:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

- [ ] **Step 5: Update sidebar branding (3 occurrences)**

In `apps/web/src/components/dashboard/sidebar.tsx`, lines 75, 87, 93 — replace "QueuePro" with "TorUp" on all three lines.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/layout.tsx apps/web/src/app/[locale]/page.tsx apps/web/src/app/[locale]/admin/layout.tsx apps/web/src/app/[locale]/(auth)/login/page.tsx apps/web/src/app/[locale]/(auth)/register/page.tsx apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx apps/web/src/app/[locale]/(auth)/reset-password/page.tsx apps/web/src/components/dashboard/sidebar.tsx
git commit -m "chore: rename UI branding QueuePro -> TorUp"
```

---

### Task 4: Regenerate lockfile and verify build

- [ ] **Step 1: Regenerate pnpm lockfile**

The lockfile contains resolved `@queue/*` references. Delete and regenerate:

```bash
rm pnpm-lock.yaml && pnpm install
```

Confirm it completes without errors. The new lockfile will use `@torup/*` names.

- [ ] **Step 2: Run full test suite**

```bash
pnpm turbo test
```

Expected: all tests pass (test code uses vitest, doesn't reference `@queue/*` directly in import maps).

- [ ] **Step 3: Run type check**

```bash
pnpm turbo type-check
```

Expected: zero type errors.

- [ ] **Step 4: Run full build**

```bash
pnpm turbo build
```

Expected: all packages and apps build successfully.

- [ ] **Step 5: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm-lock.yaml for @torup rename"
```

---

### Task 5: Rewrite CI/CD workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the entire CI file**

Remove the three GCP deploy jobs (`deploy-api`, `deploy-whatsapp`, `deploy-web`) from the CI file. Add Railway-based deploy jobs for API and WhatsApp Agent, and keep a simplified Vercel deploy for web.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Type Check
        run: pnpm turbo type-check

      - name: Build
        run: pnpm turbo build

      - name: Test
        run: pnpm turbo test

  deploy-api:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: railwayapp/railway-deploy@v1
        with:
          service: torup-api
          railway-token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-whatsapp:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: railwayapp/railway-deploy@v1
        with:
          service: torup-whatsapp
          railway-token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-web:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=@torup/web...

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
          vercel-args: --prod
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: replace GCP Cloud Run deploys with Railway + Vercel"
```

---

### Task 6: Delete GCP infrastructure files

- [ ] **Step 1: Delete GCP files**

```bash
rm cloudbuild-api.yaml cloudbuild-web.yaml cloudbuild-whatsapp.yaml .gcloudignore
```

- [ ] **Step 2: Commit**

```bash
git add cloudbuild-api.yaml cloudbuild-web.yaml cloudbuild-whatsapp.yaml .gcloudignore
git commit -m "chore: remove GCP Cloud Build configs and .gcloudignore"
```

---

### Task 7: Update Claude Code permissions

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Update @queue references in settings**

Replace all `@queue` with `@torup` in `.claude/settings.local.json`. There are several permission entries like `"pnpm --filter=@queue/api add..."` that need updating.

```bash
sed -i '' 's/@queue/@torup/g' .claude/settings.local.json
```

Also remove any `gcloud`-related permissions that are no longer needed (lines with `gcloud config`, `gcloud projects`, `gcloud services`, `gcloud billing`, `gcloud secrets`, `gcloud run`, `gcloud builds`, `gcloud artifacts`, `gcloud logging`, `gcloud auth`).

- [ ] **Step 2: Verify the settings file is still valid JSON**

```bash
python3 -c "import json; json.load(open('.claude/settings.local.json')); print('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore: update Claude permissions for @torup rename"
```

---

### Task 8: Create Railway project config

**Files:**
- Create: `railway.json`

- [ ] **Step 1: Create railway.json at repo root**

Railway can auto-detect Dockerfiles, but a config file makes service definitions explicit:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Note: Railway's monorepo support uses service-level config. Each service (`torup-api`, `torup-whatsapp`) will need to be created in the Railway dashboard pointing at its Dockerfile:
- `torup-api` → `apps/api/Dockerfile`
- `torup-whatsapp` → `services/whatsapp-agent/Dockerfile`

The web frontend stays on Vercel — no Railway service for it.

- [ ] **Step 2: Commit**

```bash
git add railway.json
git commit -m "chore: add Railway project config"
```

---

### Task 9: Manual post-merge steps (documentation)

These steps must be done manually after the PR merges to main:

- [ ] **Step 1: Railway setup**
  - Create Railway account/project at railway.com
  - Add `torup-api` service → point to `apps/api/Dockerfile`
  - Add `torup-whatsapp` service → point to `services/whatsapp-agent/Dockerfile`
  - Set env vars for both: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV`, plus `ANTHROPIC_API_KEY` for whatsapp
  - Add `RAILWAY_TOKEN` secret to GitHub repo settings

- [ ] **Step 2: Vercel reconnect**
  - Update Vercel project env vars: `NEXT_PUBLIC_API_URL` → Railway API URL
  - Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` GitHub secrets still valid

- [ ] **Step 3: Rename GitHub repo**
  - Settings → General → Repository name → `torup`

- [ ] **Step 4: Rename Supabase project**
  - Supabase dashboard → project settings → rename "QueuePro" to "TorUp"

- [ ] **Step 5: Tear down GCP**
  - Delete Cloud Run services: `queue-api`, `queue-whatsapp`, `queue-web`
  - Delete GCR container images
  - Remove GCP secrets from GitHub repo settings: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, `GCP_REGION`

---

### Task 10: Rename project directory

- [ ] **Step 1: Rename the directory**

After all commits are done and the branch is ready, rename the directory:

```bash
cd /Users/adamazz1993/Desktop
mv QueueManagement torup
cd torup
```

This is done last since all file paths change under it. Claude Code will need to be restarted in the new directory.
```

<｜｜DSML｜｜parameter name="content" string="true"># TorUp Rename & Railway Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the entire codebase from `@queue`/QueuePro to `@torup`/TorUp and migrate API + WhatsApp Agent from GCP Cloud Run to Railway (web to Vercel).

**Architecture:** Monorepo with pnpm workspaces and Turborepo. 3 services: Express API (`apps/api`, port 3001), Next.js web (`apps/web`, port 3000), WhatsApp Agent (`services/whatsapp-agent`, port 3002). API + WhatsApp → Railway. Web → Vercel. Supabase unchanged.

**Tech Stack:** TypeScript, Node.js 20, pnpm 10, Turborepo, Express, Next.js, esbuild, Docker

---

### Task 1: Rename workspace packages — @queue → @torup (package.json files)

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `services/whatsapp-agent/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/db/package.json`
- Modify: `packages/i18n/package.json`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Rename root package.json**

In `package.json`, change `"name": "queue-management"` to `"name": "torup"`.

- [ ] **Step 2: Rename apps/api/package.json**

Change `"name": "@queue/api"` to `"name": "@torup/api"`.
Change dependencies `"@queue/db": "workspace:*"` to `"@torup/db": "workspace:*"`.
Change dependencies `"@queue/shared": "workspace:*"` to `"@torup/shared": "workspace:*"`.

- [ ] **Step 3: Rename apps/web/package.json**

Change `"name": "@queue/web"` to `"name": "@torup/web"`.
Change dependencies `"@queue/db"`, `"@queue/i18n"`, `"@queue/shared"`, `"@queue/ui"` — replace `@queue` with `@torup` in all four.

- [ ] **Step 4: Rename services/whatsapp-agent/package.json**

Change `"name": "@queue/whatsapp-agent"` to `"name": "@torup/whatsapp-agent"`.
Change dependencies `"@queue/db"` and `"@queue/shared"` to `"@torup/db"` and `"@torup/shared"`.

- [ ] **Step 5: Rename packages/shared/package.json**

Change `"name": "@queue/shared"` to `"name": "@torup/shared"`.

- [ ] **Step 6: Rename packages/db/package.json**

Change `"name": "@queue/db"` to `"name": "@torup/db"`.

- [ ] **Step 7: Rename packages/i18n/package.json**

Change `"name": "@queue/i18n"` to `"name": "@torup/i18n"`.

- [ ] **Step 8: Rename packages/ui/package.json**

Change `"name": "@queue/ui"` to `"name": "@torup/ui"`.

- [ ] **Step 9: Commit**

```bash
git add package.json apps/api/package.json apps/web/package.json services/whatsapp-agent/package.json packages/shared/package.json packages/db/package.json packages/i18n/package.json packages/ui/package.json
git commit -m "chore: rename workspace packages @queue -> @torup"
```

---

### Task 2: Update Dockerfiles for new workspace names

**Files:**
- Modify: `apps/api/Dockerfile`
- Modify: `apps/web/Dockerfile`
- Modify: `services/whatsapp-agent/Dockerfile`

- [ ] **Step 1: Update apps/api/Dockerfile**

Lines 11, 22-24, 26, 41 — replace every `@queue` with `@torup`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/api...

WORKDIR /app/apps/api
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
```

- [ ] **Step 2: Update apps/web/Dockerfile**

Line 13 — replace `@queue/web` with `@torup/web`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/web...
```

- [ ] **Step 3: Update services/whatsapp-agent/Dockerfile**

Lines 11, 20-24, 26, 36 — replace every `@queue` with `@torup`:

```dockerfile
RUN pnpm install --frozen-lockfile --filter=@torup/whatsapp-agent...

WORKDIR /app/services/whatsapp-agent
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile services/whatsapp-agent/Dockerfile
git commit -m "chore: update Dockerfiles for @torup workspace names"
```

---

### Task 3: Rename UI branding — QueuePro → TorUp

**Files:**
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Update layout metadata**

In `apps/web/src/app/[locale]/layout.tsx`, line 9-10:

```tsx
export const metadata: Metadata = {
  title: "TorUp - Smart Appointment Management",
  description: "AI-powered appointment and queue management for businesses",
};
```

- [ ] **Step 2: Update landing page footer**

In `apps/web/src/app/[locale]/page.tsx`, line 76:

```tsx
<span>&copy; {new Date().getFullYear()} TorUp</span>
```

- [ ] **Step 3: Update admin header**

In `apps/web/src/app/[locale]/admin/layout.tsx`, line 25:

```tsx
<h1 className="text-xl font-bold text-primary">TorUp Admin</h1>
```

- [ ] **Step 4: Update auth pages (4 files)**

In each of these files, change the CardTitle from "QueuePro" to "TorUp":

`apps/web/src/app/[locale]/(auth)/login/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/register/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`, line 40:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

`apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`, line 59:
```tsx
<CardTitle className="text-3xl font-bold tracking-tight">TorUp</CardTitle>
```

- [ ] **Step 5: Update sidebar branding (3 occurrences)**

In `apps/web/src/components/dashboard/sidebar.tsx`, lines 75, 87, 93 — replace "QueuePro" with "TorUp" on all three lines.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/layout.tsx apps/web/src/app/[locale]/page.tsx apps/web/src/app/[locale]/admin/layout.tsx apps/web/src/app/[locale]/(auth)/login/page.tsx apps/web/src/app/[locale]/(auth)/register/page.tsx apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx apps/web/src/app/[locale]/(auth)/reset-password/page.tsx apps/web/src/components/dashboard/sidebar.tsx
git commit -m "chore: rename UI branding QueuePro -> TorUp"
```

---

### Task 4: Regenerate lockfile and verify build

- [ ] **Step 1: Regenerate pnpm lockfile**

The lockfile contains resolved `@queue/*` references. Delete and regenerate:

```bash
rm pnpm-lock.yaml && pnpm install
```

Confirm it completes without errors. The new lockfile will use `@torup/*` names.

- [ ] **Step 2: Run full test suite**

```bash
pnpm turbo test
```

Expected: all tests pass (test code uses vitest, doesn't reference `@queue/*` directly in import maps).

- [ ] **Step 3: Run type check**

```bash
pnpm turbo type-check
```

Expected: zero type errors.

- [ ] **Step 4: Run full build**

```bash
pnpm turbo build
```

Expected: all packages and apps build successfully.

- [ ] **Step 5: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm-lock.yaml for @torup rename"
```

---

### Task 5: Rewrite CI/CD workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the entire CI file**

Remove the three GCP deploy jobs (`deploy-api`, `deploy-whatsapp`, `deploy-web`) from the CI file. Add Railway-based deploy jobs for API and WhatsApp Agent, and keep a simplified Vercel deploy for web.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Type Check
        run: pnpm turbo type-check

      - name: Build
        run: pnpm turbo build

      - name: Test
        run: pnpm turbo test

  deploy-api:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: railwayapp/railway-deploy@v1
        with:
          service: torup-api
          railway-token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-whatsapp:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: railwayapp/railway-deploy@v1
        with:
          service: torup-whatsapp
          railway-token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-web:
    needs: lint-typecheck-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=@torup/web...

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
          vercel-args: --prod
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: replace GCP Cloud Run deploys with Railway + Vercel"
```

---

### Task 6: Delete GCP infrastructure files

- [ ] **Step 1: Delete GCP files**

```bash
rm cloudbuild-api.yaml cloudbuild-web.yaml cloudbuild-whatsapp.yaml .gcloudignore
```

- [ ] **Step 2: Commit**

```bash
git rm cloudbuild-api.yaml cloudbuild-web.yaml cloudbuild-whatsapp.yaml .gcloudignore
git commit -m "chore: remove GCP Cloud Build configs and .gcloudignore"
```

---

### Task 7: Update Claude Code permissions

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Update @queue references and remove gcloud permissions**

Run this Python script to replace `@queue` with `@torup` and strip all `gcloud`-related permission entries:

```bash
python3 -c "
import json
with open('.claude/settings.local.json') as f:
    cfg = json.load(f)
# Replace @queue with @torup in all allow entries
cfg['permissions']['allow'] = [
    e.replace('@queue', '@torup') for e in cfg['permissions']['allow']
]
# Remove gcloud entries
cfg['permissions']['allow'] = [
    e for e in cfg['permissions']['allow'] if 'gcloud' not in e
]
with open('.claude/settings.local.json', 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print('Done')
"
```

- [ ] **Step 2: Verify the settings file is still valid JSON**

```bash
python3 -c "import json; json.load(open('.claude/settings.local.json')); print('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore: update Claude permissions for @torup rename"
```

---

### Task 8: Create Railway project config

**Files:**
- Create: `railway.json`

- [ ] **Step 1: Create railway.json at repo root**

Railway can auto-detect Dockerfiles, but a config file makes service definitions explicit:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Note: Railway's monorepo support uses service-level config. Each service (`torup-api`, `torup-whatsapp`) will need to be created in the Railway dashboard pointing at its Dockerfile:
- `torup-api` → `apps/api/Dockerfile`
- `torup-whatsapp` → `services/whatsapp-agent/Dockerfile`

The web frontend stays on Vercel — no Railway service for it.

- [ ] **Step 2: Commit**

```bash
git add railway.json
git commit -m "chore: add Railway project config"
```

---

### Task 9: Manual post-merge steps (documentation)

These steps must be done manually after the PR merges to main:

- [ ] **Step 1: Railway setup**
  - Create Railway account/project at railway.com
  - Add `torup-api` service → point to `apps/api/Dockerfile`
  - Add `torup-whatsapp` service → point to `services/whatsapp-agent/Dockerfile`
  - Set env vars for both: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV`, plus `ANTHROPIC_API_KEY` for whatsapp
  - Add `RAILWAY_TOKEN` secret to GitHub repo settings

- [ ] **Step 2: Vercel reconnect**
  - Update Vercel project env vars: `NEXT_PUBLIC_API_URL` → Railway API URL
  - Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` GitHub secrets still valid

- [ ] **Step 3: Rename GitHub repo**
  - Settings → General → Repository name → `torup`

- [ ] **Step 4: Rename Supabase project**
  - Supabase dashboard → project settings → rename "QueuePro" to "TorUp"

- [ ] **Step 5: Tear down GCP**
  - Delete Cloud Run services: `queue-api`, `queue-whatsapp`, `queue-web`
  - Delete GCR container images
  - Remove GCP secrets from GitHub repo settings: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, `GCP_REGION`

---

### Task 10: Rename project directory

- [ ] **Step 1: Rename the directory**

After all commits are done and the branch is ready, rename the directory:

```bash
cd /Users/adamazz1993/Desktop
mv QueueManagement torup
cd torup
```

This is done last since all file paths change under it. Claude Code will need to be restarted in the new directory.
```
