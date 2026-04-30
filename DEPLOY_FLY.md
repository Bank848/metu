# Deploying METU to Fly.io (Singapore region)

This is the alternative to Vercel that runs the function in **`sin`
(Singapore)** — same datacenter as Supabase Postgres — so latency drops
from ~1 s/request (Vercel `iad1` ↔ Supabase Singapore) to **<100 ms**.
Setup takes ~15 minutes the first time. After that, deploys are a
single `fly deploy` command.

---

## What you ship

- `Dockerfile`         — multi-stage Node 20 Alpine image (~140 MB).
- `fly.toml`           — region `sin`, 512 MB shared-cpu-1x, health
                         check on `/api/health`, release command runs
                         Prisma migrate.
- `.dockerignore`      — keeps the build context tight + safe.
- `apps/web/next.config.mjs` — `output: "standalone"` +
                                `outputFileTracingRoot` for monorepo.

## Cost

Fly.io gives every account **$5/month free credit**. The recommended
machine size (shared-cpu-1x · 512 MB) costs ~$3.88/mo, well under the
credit. Bumping to 1 GB (~$5.70/mo) will start charging ~$0.70/mo.

Supabase stays the same — keep your existing project (free tier).

---

## One-time setup

### 1. Install `flyctl`

```bash
# macOS / Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

Then add to `PATH` and reopen your shell. Verify:

```bash
fly version
```

### 2. Sign up / log in

```bash
fly auth signup     # first time
# or
fly auth login      # if you already have a Fly account
```

A browser window opens — sign in there. You'll be asked for a credit
card to verify the account; you won't be charged until you exceed the
$5 monthly free credit.

### 3. Launch the app (no deploy yet)

From the repo root:

```bash
fly launch --no-deploy --copy-config --name metu-web
```

- `--copy-config` reuses our existing `fly.toml`.
- `--name metu-web` picks the URL (`https://metu-web.fly.dev`). If the
  name is taken, Fly will suggest alternatives.
- `--no-deploy` lets us set secrets first.

When asked about Postgres or Redis, **say no** — we use Supabase, not
Fly's Postgres.

### 4. Set the runtime secrets

Grab these from your Supabase dashboard → Project Settings → Database
→ Connect (top-right green button):

- **Transaction pooler** URL (port 6543) — used at runtime. Add the
  flags `?pgbouncer=true&connection_limit=1` so Prisma disables
  prepared statements (incompatible with pgbouncer transaction mode)
  and each Fly machine holds one Postgres-side connection.
- **Session pooler** URL (port 5432) — used by the release-phase
  migrate. The free tier's *direct* `db.<ref>.supabase.co` host is
  IPv6-only and Fly's egress is IPv4, so the session pooler (which
  speaks IPv4 + supports DDL) is the correct migration target.

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres.PROJECTREF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1" \
  DATABASE_URL_UNPOOLED="postgresql://postgres.PROJECTREF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  NEXT_PUBLIC_SITE_URL="https://metu-web.fly.dev"
```

If you don't have `openssl`, generate a JWT secret with any 64-char
random string.

### 5. First deploy

```bash
fly deploy
```

Flow:
1. Builds the Docker image locally (or remotely on Fly's builders if
   `--remote-only`).
2. Pushes to Fly's registry.
3. Runs the **release command** (Prisma migrate against Supabase).
4. Spins up a `sin` machine, waits for `/api/health` to return 200.
5. Switches edge traffic to the new machine.

First deploy takes 5-8 minutes (Docker build dominates). Subsequent
deploys ride the layer cache and finish in 60-90 seconds.

### 6. Smoke test

```bash
curl https://metu-web.fly.dev/api/health
# {"status":"ok","db":"connected","pingMs":<small>,...}

# Time a real page render — should be <500ms now (was ~1s on Vercel iad1)
curl -s -o /dev/null -w "%{time_total}\n" https://metu-web.fly.dev/
```

---

## Day-to-day commands

| Task | Command |
|---|---|
| Deploy a new version | `fly deploy` |
| Live-tail logs | `fly logs` |
| SSH into the running machine | `fly ssh console` |
| List secrets (names only) | `fly secrets list` |
| Update a secret | `fly secrets set KEY="..."` (triggers redeploy) |
| Scale memory up | `fly scale memory 1024` |
| Stop the app temporarily | `fly machine stop` |
| Open the app in a browser | `fly open` |

---

## Troubleshooting

**"Error: P1001: Can't reach database server"** during release.
The `DATABASE_URL_UNPOOLED` secret isn't set or points at the pooled
endpoint. Re-run `fly secrets set DATABASE_URL_UNPOOLED="..."` with
the direct URL (hostname without `-pooler`).

**OOM-killed under load.**
512 MB is borderline for Next 14 with many concurrent users. Bump to
1 GB: `fly scale memory 1024`.

**Build fails with `prisma: command not found` at release.**
The Dockerfile copies `node_modules/prisma` into the runner stage —
make sure that line is intact and `prisma` is in `apps/web/package.json`
`devDependencies` (which is what `npm ci --include=dev` installs).

**Static images 404.**
Confirm the Dockerfile copies both `.next/static` AND `public/` into
the runner stage at the matching paths. Both lines must reference
`apps/web/`.

**`/api/health` is slow even on Singapore machine.**
Most likely your Supabase project is in a different region — region is
fixed at project creation time. Singapore = `ap-southeast-1`. If
your project is in `us-west-1` or similar, create a new project in
Singapore and re-run `prisma migrate deploy` + the seed script against
the new connection string before swapping the Fly secret.

---

## Custom domain (optional)

Point your own domain at the Fly app:

```bash
fly certs add www.example.com
fly certs show www.example.com   # shows DNS records to add
```

Then add a `CNAME` record at your DNS provider pointing
`www.example.com` → `metu-web.fly.dev`. Cert provisions automatically
in ~1 minute via Let's Encrypt.

---

## Reverting to Vercel

The Vercel deploy stays untouched — it just sits idle. To switch
back, point your DNS / users at `https://metu-web-phi.vercel.app` and
optionally `fly machine stop` to halt the Fly machine while you decide.

If you want to fully tear down the Fly app: `fly apps destroy metu-web`.
