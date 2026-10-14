# syntax=docker/dockerfile:1

# =============================================================
# Base - shared Node image
# =============================================================
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# =============================================================
# Backend - Fastify API
# =============================================================
FROM base AS backend-deps
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci

FROM base AS backend-build
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json ./
COPY backend/tsconfig.json ./
COPY backend/tsconfig.scripts.build.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
RUN npm run build && ./node_modules/.bin/tsc -p tsconfig.scripts.build.json

FROM base AS backend
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=backend-deps /app/backend/package.json /app/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY backend/migrations ./migrations
RUN mkdir -p uploads
EXPOSE 4000
CMD ["sh", "-c", "node dist/scripts/migrate.js 2>/dev/null || true; node dist/scripts/create-superadmin.js 2>/dev/null || true; node dist/server.js"]

# =============================================================
# Web - Next.js standalone
# =============================================================
FROM base AS web-deps
COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm install --no-audit --no-fund

FROM base AS web-build
WORKDIR /app/web
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM base AS web
WORKDIR /app/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=web-build /app/web/public ./public
COPY --from=web-build /app/web/.next/standalone ./
COPY --from=web-build /app/web/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# =============================================================
# Production - combined Web + API in a single container
# =============================================================
# This is the default build target (last stage) so a single Render
# service can host both Next.js and the Fastify API.
#
#   Next.js (standalone)  -> Render PORT (e.g. 4000)
#   Fastify API           -> internal API_PORT (default 5000)
#                            Next.js proxies /api/* to BACKEND_URL
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV API_PORT=5000
ENV BACKEND_URL=http://127.0.0.1:5000
ENV MIGRATIONS_DIR=/app/backend/migrations
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=backend /app/backend ./backend
COPY --from=web /app/web ./
COPY --from=web-build /app/web/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chown -R nextjs:nodejs /app && chmod +x /app/docker-entrypoint.sh
USER nextjs
EXPOSE 3000
CMD ["/app/docker-entrypoint.sh"]