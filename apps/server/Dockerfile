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
# Pinned base image + apk versions for reproducible builds.
FROM node:20.20-alpine AS deps
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.7-r0
WORKDIR /app

# Lockfile + every workspace package.json (workspace install needs them
# all up-front so npm can resolve symlinks). We copy package.json files
# only — no src — to keep this layer cache-friendly.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# `--ignore-scripts` skips apps/web's prisma postinstall AND
# @metu/db's prisma generate postinstall — both fail at this stage
# because the schema file isn't copied yet. The builder stage runs
# `prisma generate` explicitly once the source tree is present.
#
# Phase 14.1 note: better-auth's `dist/.../prisma-adapter/index.mjs`
# re-exports from the separate `@better-auth/prisma-adapter`
# package. We install that package as a direct dep on @metu/server
# (see apps/server/package.json) so npm puts it at workspace level
# instead of relying on better-auth's install hook to materialise
# the nested copy — which `--ignore-scripts` would skip.
RUN npm ci --include=dev --ignore-scripts

# ───── Stage 2: builder ─────
FROM node:20.20-alpine AS builder
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.7-r0
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
# Phase 14.1 fix — npm 7+ workspaces install per-workspace deps
# under apps/<name>/node_modules + packages/<name>/node_modules
# when there's a version conflict or workspace-only dep
# (better-auth lives at apps/server/node_modules/better-auth in
# our case). The previous Dockerfile only copied the hoisted root
# node_modules, so tsc couldn't resolve any workspace-local
# package. Bringing across the entire deps tree (which at this
# stage is just package.json + node_modules) lets the subsequent
# `COPY . .` overlay the real source on top.
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY . .

# Generate Prisma Client against our schema. Wrapped in a retry loop
# because binaries.prisma.sh has been ECONNRESETting on Fly's build
# network. 10 attempts with linear backoff (10/20/.../100s); FATAL
# exit on total failure so the build doesn't proceed without a
# generated Prisma client. Same pattern as the BFF Dockerfile.
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

# Build @metu/shared first so the server's `import { ... } from "@metu/shared"`
# resolves to compiled .js (apps/server/tsconfig is NodeNext + strict).
RUN npm run build -w @metu/shared
# Then build the server itself.
RUN npm run build -w @metu/server

# ───── Stage 3: runner ─────
FROM node:20.20-alpine AS runner
RUN apk add --no-cache gcompat=1.1.0-r4 openssl=3.5.7-r0
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
# Phase 14.1 fix — workspace-local node_modules (e.g.
# apps/server/node_modules/better-auth) need to ship to the runner
# too. Same root cause as the builder fix: npm 7+ workspaces store
# per-workspace deps under apps/<name>/node_modules when the dep
# can't hoist (better-auth has nested @better-auth/* peer chains
# so it lands at apps/server/node_modules/better-auth).
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodeapi \
 && chown -R nodeapi:nodejs /app
USER nodeapi

EXPOSE 8080

CMD ["node", "apps/server/dist/app.js"]
