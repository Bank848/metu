# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
#  METU — Fly.io image
#
#  Three stages:
#    1. `deps`   — resolve the full monorepo workspace node_modules.
#    2. `builder`— generate Prisma Client + `next build` in standalone mode.
#    3. `runner` — minimal runtime with only what the production server needs.
#
#  Prisma notes: the standalone output does NOT automatically include the
#  Prisma generated client nor the query-engine binary, so we copy them
#  explicitly from the builder stage. We also keep the schema + `prisma`
#  CLI so Fly's `release_command` can run `prisma migrate deploy`.
# ─────────────────────────────────────────────────────────────────────────────

# ───── Stage 1: deps ─────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy lockfile + every workspace package.json so `npm ci` resolves deterministically.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# `--ignore-scripts` skips apps/web's `postinstall: prisma generate ...` —
# the schema file isn't in this stage yet (we only copied package.json
# files for layer-cache friendliness). The builder stage runs
# `prisma generate` explicitly once the full source is in place.
RUN npm ci --include=dev --ignore-scripts

# ───── Stage 2: builder ─────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client against our schema.
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build Next in standalone mode (see apps/web/next.config.mjs).
# `apps/web/scripts/build.mjs` gracefully skips `prisma migrate deploy`
# when DATABASE_URL isn't set (it isn't, inside docker build), so only
# `next build` runs here.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @metu/web

# ───── Stage 3: runner ─────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Fly expects the server to bind 0.0.0.0:$PORT — fly.toml maps 3000
# internally to the public edge, so keep these consistent.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 3a. Next.js standalone bundle — includes the minimal server, production
#     node_modules subset, and the workspace packages.
COPY --from=builder /app/apps/web/.next/standalone ./
# 3b. Static assets — Next docs call out that `static/` + `public/` must be
#     copied manually into the standalone tree.
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# 3c. Prisma runtime pieces — standalone tracing doesn't catch these reliably.
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# `prisma` CLI lets `fly.toml`'s `release_command` run `prisma migrate deploy`
# against Neon each deploy.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Non-root user is a Fly best practice.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# The standalone entry is emitted at apps/web/server.js because our
# workspace layout places the app there.
CMD ["node", "apps/web/server.js"]
