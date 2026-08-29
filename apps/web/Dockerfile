FROM node:20-slim AS base
RUN npm install -g pnpm@10

FROM base AS builder
WORKDIR /app

# 1. Copy only manifests + lockfile first. This layer — and the pnpm install
#    below — is cached and only re-runs when a package.json or the lockfile
#    changes, not on every source edit.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json     packages/db/
COPY packages/ui/package.json     packages/ui/
COPY packages/i18n/package.json   packages/i18n/
COPY apps/web/package.json        apps/web/

# 2. Install deps. This layer is cached and only re-runs when a package.json or
#    the lockfile changes (the COPYs above), not on every source edit.
RUN pnpm install --frozen-lockfile --filter=@torup/web...

# 3. Now copy source. Edits here no longer bust the install layer above.
COPY packages/shared/ packages/shared/
COPY packages/db/     packages/db/
COPY packages/ui/     packages/ui/
COPY packages/i18n/   packages/i18n/
COPY apps/web/        apps/web/

# 4. Build workspace deps, then the app.
WORKDIR /app/packages/shared
RUN pnpm run build
WORKDIR /app/packages/db
RUN pnpm run build
WORKDIR /app/packages/ui
RUN pnpm run build
WORKDIR /app/packages/i18n
RUN pnpm run build

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

# Production
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
# "::" binds dual-stack (both IPv4 and IPv6). "0.0.0.0" is IPv4-only, which
# left the app unreachable to Railway's healthcheck prober — every other
# service in this repo (Express, via app.listen(port) with no host) binds
# dual-stack by default, this one has to opt in explicitly.
ENV HOSTNAME="::"
CMD ["node", "apps/web/server.js"]
