FROM node:22-slim AS base
RUN npm install -g pnpm@10

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY services/whatsapp-agent/ services/whatsapp-agent/

RUN pnpm install --frozen-lockfile --filter=@torup/whatsapp-agent...

WORKDIR /app/packages/shared
RUN pnpm run build
WORKDIR /app/packages/db
RUN pnpm run build

WORKDIR /app/services/whatsapp-agent
# Resolve workspace symlinks to real copies for esbuild
RUN rm -rf node_modules/@torup 2>/dev/null; \
    mkdir -p node_modules/@torup/db node_modules/@torup/shared && \
    cp -r /app/packages/db/dist/ node_modules/@torup/db/dist/ && \
    cp /app/packages/db/package.json node_modules/@torup/db/ && \
    cp -r /app/packages/shared/dist/ node_modules/@torup/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@torup/shared/

RUN pnpm run build:docker

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/services/whatsapp-agent/dist/index.js ./dist/index.js
COPY --from=builder /app/services/whatsapp-agent/package.json ./

RUN node -e "const p=require('./package.json'); delete p.dependencies['@torup/db']; delete p.dependencies['@torup/shared']; delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" && \
    npm install --omit=dev

EXPOSE 3002
CMD ["node", "dist/index.js"]
