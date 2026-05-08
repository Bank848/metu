# syntax=docker/dockerfile:1.7
# METU — Fly.io image. Three stages: deps → builder (Prisma + next build) → runner.
# Standalone Next output doesn't trace the Prisma client/engine, so we copy them in by hand.

# ───── Stage 1: deps ─────
FROM node:20.20-alpine AS deps
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# --ignore-scripts skips apps/web's prisma-generate postinstall — no schema yet here.
RUN npm ci --include=dev --ignore-scripts

# ───── Stage 2: builder ─────
FROM node:20.20-alpine AS builder
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Retry prisma generate — binaries.prisma.sh has been ECONNRESETting on Fly's network.
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

# NEXT_PUBLIC_* are inlined into the JS bundle at build time. Defaults below are
# syntactically valid (real URL / non-empty strings) so `new URL(...)` calls in the
# page-data-collection phase don't throw when no build args are passed (e.g. when
# deploying via the Fly.io web UI). Override with real values via:
#   • flyctl deploy --build-arg NAME=value   (scripts/deploy-web.sh does this)
#   • fly.toml [build.args] block
#   • Fly.io dashboard build-args panel
# A build with these placeholders SUCCEEDS but ships a non-functional Firebase /
# Stripe / Sentry — the live app needs the real keys passed at deploy time.
ARG NEXT_PUBLIC_SITE_URL=https://metu.online
ARG NEXT_PUBLIC_FIREBASE_API_KEY=build-placeholder
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=metu-placeholder.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=metu-placeholder
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_build_placeholder
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @metu/web

# ───── Stage 3: runner ─────
FROM node:20.20-alpine AS runner
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.6-r0
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Standalone bundle + static + public.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Prisma runtime pieces — standalone tracing doesn't catch these.
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 8080

CMD ["node", "apps/web/server.js"]
