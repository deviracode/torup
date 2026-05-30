FROM node:22-slim AS base
RUN npm install -g pnpm@10

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/api/ apps/api/

RUN pnpm install --frozen-lockfile --filter=@torup/api...

# Build workspace deps so esbuild can bundle them
WORKDIR /app/packages/shared
RUN pnpm run build
WORKDIR /app/packages/db
RUN pnpm run build

# Copy built workspace packages into node_modules (symlink workaround)
WORKDIR /app/apps/api
# Resolve workspace symlinks to real copies for esbuild
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

# Bundle with esbuild — workspace packages are inlined, npm deps stay external
RUN pnpm run build:docker

# Production — only npm deps needed
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist/index.js ./dist/index.js
COPY --from=builder /app/apps/api/package.json ./

# Strip workspace deps, install only npm deps
RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
    npm install --omit=dev

EXPOSE 3001
CMD ["node", "dist/index.js"]
