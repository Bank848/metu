# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
#  METU API server — Fly.io image (apps/server)
#
#  Three stages mirroring the root Dockerfile:
#    1. `deps`    — npm ci against the workspace lockfile so installs stay
#                   deterministic + cache-friendly.
#    2. `builder` — Prisma Client generation + tsc compile for the server
#                   AND the @metu/shared package (server depends on the
#                   compiled .js, not the .ts source).
#    3. `runner`  — minimal runtime: compiled dist + the prod node_modules
#                   subset + Prisma runtime pieces.
#
#  We share node_modules across the workspace so `npm ci` runs once at the
#  top level and the apps/server stage just imports what it needs.
# ─────────────────────────────────────────────────────────────────────────────

# ───── Stage 1: deps ─────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Lockfile + every workspace package.json (workspace install needs them
# all up-front so npm can resolve symlinks). We copy package.json files
# only — no src — to keep this layer cache-friendly.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# Phase 14.1 — dropped `--ignore-scripts` because better-auth's
# nested @better-auth/prisma-adapter dep relies on its parent's
# install hook to materialise the dist re-exports. We still skip
# apps/web's postinstall by simply not building it in this server
# stage; the explicit `prisma generate` below takes care of @metu/db.
RUN npm ci --include=dev

# ───── Stage 2: builder ─────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client against our schema.
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build @metu/shared first so the server's `import { ... } from "@metu/shared"`
# resolves to compiled .js (apps/server/tsconfig is NodeNext + strict).
RUN npm run build -w @metu/shared
# Then build the server itself.
RUN npm run build -w @metu/server

# ───── Stage 3: runner ─────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
# Fly conventionally uses 8080 for the public-facing port; the app
# reads from `API_PORT` first then `PORT`, so this works either way.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Workspace files needed at runtime — keep package.json for npm
# workspace symlink resolution.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/db/package.json ./packages/db/

# Compiled JS — server + shared.
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Prisma schema + generated client. The schema is needed for
# `prisma migrate deploy` in the Fly release_command.
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules ./node_modules

# Non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodeapi \
 && chown -R nodeapi:nodejs /app
USER nodeapi

EXPOSE 8080

CMD ["node", "apps/server/dist/app.js"]
