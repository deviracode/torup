FROM node:20-slim AS base
RUN npm install -g pnpm@10

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY services/whatsapp-agent/ services/whatsapp-agent/

RUN pnpm install --frozen-lockfile --filter=@queue/whatsapp-agent...

WORKDIR /app/packages/shared
RUN pnpm run build
WORKDIR /app/packages/db
RUN pnpm run build

WORKDIR /app/services/whatsapp-agent
# Resolve workspace symlinks to real copies for esbuild
RUN rm -rf node_modules/@queue 2>/dev/null; \
    mkdir -p node_modules/@queue/db node_modules/@queue/shared && \
    cp -r /app/packages/db/dist/ node_modules/@queue/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@queue/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@queue/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@queue/shared/

RUN pnpm run build:docker

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/services/whatsapp-agent/dist/index.js ./dist/index.js
COPY --from=builder /app/services/whatsapp-agent/package.json ./

RUN node -e "const p=require('./package.json'); delete p.dependencies['@queue/db']; delete p.dependencies['@queue/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
    npm install --omit=dev

EXPOSE 3002
CMD ["node", "dist/index.js"]
