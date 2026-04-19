FROM node:20-slim AS base
RUN npm install -g pnpm@10

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/api/ apps/api/

RUN pnpm install --frozen-lockfile --filter=@queue/api...

# Build workspace deps so esbuild can bundle them
WORKDIR /app/packages/shared
RUN pnpm run build
WORKDIR /app/packages/db
RUN pnpm run build

# Copy built workspace packages into node_modules (symlink workaround)
WORKDIR /app/apps/api
# Resolve workspace symlinks to real copies for esbuild
RUN rm -rf node_modules/@queue 2>/dev/null; \
    mkdir -p node_modules/@queue/db node_modules/@queue/shared && \
    cp -r /app/packages/db/dist/ node_modules/@queue/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@queue/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@queue/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@queue/shared/

# Bundle with esbuild — workspace packages are inlined, npm deps stay external
RUN pnpm run build:docker

# Production — only npm deps needed
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist/index.js ./dist/index.js
COPY --from=builder /app/apps/api/package.json ./

# Strip workspace deps, install only npm deps
RUN node -e "const p=require('./package.json'); delete p.dependencies['@queue/db']; delete p.dependencies['@queue/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
    npm install --omit=dev

EXPOSE 3001
CMD ["node", "dist/index.js"]
