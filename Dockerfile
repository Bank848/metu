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
# Pinned base image + apk versions for reproducible builds.
FROM node:20.20-alpine AS deps
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
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
FROM node:20.20-alpine AS builder
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client against our schema. Wrapped in a retry loop
# because binaries.prisma.sh has been ECONNRESETting on Fly's build
# network — multiple deploys failed before this. Retry up to 4 times
# with exponential backoff so a transient TLS hiccup doesn't break a
# deploy. CRITICAL: track success and exit non-zero if ALL attempts
# fail — earlier rev let the loop exit 0 even on total failure, so
# the build proceeded with NO Prisma client generated and crashed
# later with MODULE_NOT_FOUND.
RUN ok=false; \
    for i in 1 2 3 4 5 6 7 8 9 10; do \
      if npx prisma generate --schema=packages/db/prisma/schema.prisma; then \
        ok=true; break; \
      fi; \
      echo "prisma generate attempt $i failed; sleeping $((i * 10))s and retrying..."; \
      sleep $((i * 10)); \
    done; \
    if [ "$ok" != "true" ]; then \
      echo "FATAL: prisma generate failed after 10 attempts (binaries.prisma.sh outage)"; \
      exit 1; \
    fi

# NEXT_PUBLIC_* env vars are inlined into the client bundle by Next at
# build time, NOT picked up at runtime. Fly's `flyctl secrets set` only
# affects runtime env, so we accept these as build args and re-export
# them as ENV before `next build` runs. Values come from fly.toml's
# `[build.args]` block (or `--build-arg` overrides on `flyctl deploy`).
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# Build Next in standalone mode (see apps/web/next.config.mjs).
# `apps/web/scripts/build.mjs` gracefully skips `prisma migrate deploy`
# when DATABASE_URL isn't set (it isn't, inside docker build), so only
# `next build` runs here.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @metu/web

# ───── Stage 3: runner ─────
FROM node:20.20-alpine AS runner
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Fly expects the server to bind 0.0.0.0:$PORT. The Fly UI launch flow
# stored internal_port=8080 in the app's config — match that here so we
# don't have to override the live config from the dashboard.
ENV PORT=8080
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

# 3d. Sharp for Next.js Image optimization — REVERTED.
#
# Multiple attempts to install sharp into the standalone runner all
# failed in production: `npm install --no-save` in /app silently no-
# op'd; isolated install + cp -rn with --omit=optional skipped the
# native binary; --include=optional broke the build. The 'sharp is
# required' warnings continue but Next falls back to its JS image
# pipeline which works (just slower per request — first paint is
# unaffected, only subsequent image transforms are).
#
# Tracking this for post-defense: see if upgrading the apps/web
# package.json to add sharp directly + dropping --ignore-scripts on
# the deps stage gets it traced into the standalone output.

# Non-root user is a Fly best practice.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 8080

# The standalone entry is emitted at apps/web/server.js because our
# workspace layout places the app there.
CMD ["node", "apps/web/server.js"]
