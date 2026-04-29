# Google OAuth Setup (Phase 18)

This guide walks through provisioning a Google OAuth client so the
"Sign in with Google" button on `/login` actually works. METU uses
better-auth's Google provider, mounted only when `GOOGLE_CLIENT_ID`
is present (see [`apps/server/src/lib/auth.ts:178`](../apps/server/src/lib/auth.ts)).

When unset, the login form hides the button automatically and the
profile page shows "Google sign-in is not configured for this server."
Local dev without OAuth credentials still boots cleanly — Google is
optional.

## 1. Create a Google Cloud project

Open https://console.cloud.google.com/projectcreate and create a
project named e.g. `metu-marketplace-dev` (one project per
environment is the cleanest; you can also share one project across
dev + prod).

## 2. Configure the OAuth consent screen

Navigate to **APIs & Services → OAuth consent screen** and fill in:

- **User Type:** External
- **App name:** METU
- **User support email:** your email
- **Authorized domains:** `metu.fly.dev` (prod only — skip for dev-only project)
- **Scopes — add these three** (better-auth requests them by default):
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`

Save and continue. While in **Testing** mode you must add yourself
as a test user before sign-in works.

## 3. Create the OAuth 2.0 Client ID

Navigate to **APIs & Services → Credentials → Create credentials → OAuth client ID**.

- **Application type:** Web application
- **Name:** `METU local` (or `METU prod`)
- **Authorized JavaScript origins:**
  - `http://localhost:3000` (dev)
  - `https://metu.fly.dev` (prod)
- **Authorized redirect URIs** — must match EXACTLY (case-sensitive, no trailing slash):
  - `http://localhost:3000/api/auth/better/callback/google` (dev)
  - `https://metu.fly.dev/api/auth/better/callback/google` (prod)

The path `/api/auth/better/callback/google` comes from better-auth's
`basePath: "/api/auth/better"` config plus the built-in
`/callback/<provider>` suffix.

Click **Create**. Copy the **Client ID** and **Client secret** —
the secret only shows once.

## 4. Wire credentials locally

Paste into the root `.env` (NOT `.env.example`):

```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-yyyyy.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-zzzzzzzzzzzz
```

Restart the API server (`npm run dev -w @metu/server`). Verify by
hitting:

```bash
curl http://localhost:3000/api/settings | jq .googleEnabled
# → true
```

The login form at `http://localhost:3000/login` should now show the
"Sign in with Google" button.

## 5. Production deploy (Fly)

Set the secrets on the Express machine:

```bash
flyctl secrets set -a metu-api \
  GOOGLE_CLIENT_ID='...' \
  GOOGLE_CLIENT_SECRET='...'
```

Add the prod redirect URI to the SAME OAuth client in Google Cloud
(supports multiple URIs). No need to create a separate prod client
unless you want strict env separation.

The web BFF (`metu`) does not need the secrets — better-auth runs
server-side on `metu-api`.

## Troubleshooting

**`redirect_uri_mismatch`** — case-sensitive comparison. Common
mistakes: trailing slash, `https` vs `http`, missing `/api`. Compare
against the exact URI Google Cloud has on file.

**`EmailAlreadyRegistered` (HTTP 409)** — fired by the
`databaseHooks.user.create.before` hook
([`auth.ts:295`](../apps/server/src/lib/auth.ts)) when the Google
profile email matches an existing local-password account. This is
intentional — anyone can register a Google account using any email,
so silently auto-linking would be an account-takeover vector. The
user should sign in with their password first, then link Google
from `/profile/edit`.

**`PROVIDER_NOT_FOUND`** — env vars unset at server boot. The
provider only mounts when `GOOGLE_CLIENT_ID` is truthy at startup.
Restart after editing `.env`.

**Login bounces back to `/login?error=...`** — better-auth surfaces
OAuth errors via the `errorCallbackURL` query param the Google
button on `LoginForm` sets. Common errors: `email-exists` (409 from
the hook above), `access_denied` (user canceled the consent screen),
`invalid_grant` (client clock drift > 5 min — sync NTP).
