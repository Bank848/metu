#!/usr/bin/env bash
# Deploy the metu (Next.js web) app to Fly with NEXT_PUBLIC_* baked in.
#
# Why this script: NEXT_PUBLIC_* values are inlined into the JS bundle at
# build time (Next.js compile), but `flyctl secrets set` only affects
# runtime env. So they must be passed as Docker build args. We keep the
# real values in .env.deploy.local (gitignored) instead of fly.toml so
# they don't trip GitHub secret scanning, even though they're public by
# design (browser-visible in the bundle).
#
# Usage:
#   bash scripts/deploy-web.sh
#
# .env.deploy.local format (one KEY=VALUE per line, no quotes):
#   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
#   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=metu-prod.firebaseapp.com
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID=metu-prod
#   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
#   NEXT_PUBLIC_SITE_URL=https://metu.online
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.deploy.local ]; then
  echo "✗ .env.deploy.local not found. Create it from the template at the top of this script."
  exit 1
fi

# Build the --build-arg flag list from the env file. Skip blank/commented lines.
ARGS=()
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac
  ARGS+=(--build-arg "$line")
done < .env.deploy.local

echo "→ flyctl deploy --remote-only -a metu (with ${#ARGS[@]} build args)"
flyctl deploy --remote-only -a metu "${ARGS[@]}"
