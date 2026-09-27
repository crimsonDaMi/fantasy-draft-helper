FROM node:24-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11 --activate

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_UI_MODE
ENV VITE_UI_MODE=$VITE_UI_MODE
RUN pnpm --recursive build

# Production dependencies of the API only. The web app is served as static
# files from its build output, so none of its dependencies are needed at
# runtime.
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod --filter @fantasy-draft-helper/api

# Keeps the /app layout the API resolves paths against: the root
# package.json (for the version in /health), apps/api/dist, and
# apps/web/dist next to it.
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
# The data directory must be owned by the unprivileged user before the
# VOLUME line, so a fresh named volume inherits that ownership.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/dist/server.js"]
