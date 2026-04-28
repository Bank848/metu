# `@metu/server` — Express API

The HTTP API behind METU. Owns Prisma + business logic. The Next.js
client (`apps/web`) is a BFF that fetches from this server in its
Server Components.

> **Phase 13.1 — Catalog migration.** Five resources live here today:
> `health`, `products`, `stores`, `categories`, `tags`. The rest of
> the API still lives in `apps/web/app/api/**` while we migrate it
> module-by-module (Phase 13.2 = auth, 13.3 = cart, …).

---

## Why we did this

The pre-Phase-13 codebase mixed everything in Next.js — pages,
client components, route handlers, Prisma queries, business logic —
all under `apps/web`. It worked, but it muddied two stories the
CPE241 syllabus expects to see clearly:

1. **Layered backend.** Routes / controllers / services / models
   isn't visible when every API path is just `app/api/foo/route.ts`
   doing a Prisma query inline.
2. **Client/server split.** `getServerSession()` + RSC + direct
   Prisma in the same tree blurs where the boundary actually is.

Phase 13 splits them. The client (`apps/web`) keeps owning UI +
SSR + RSC. The server (`apps/server`) owns Prisma + the API. Both
share `packages/db` (schema) and `packages/shared` (zod schemas).

## Stack choice — why Express?

| Option | Why we picked / passed |
|---|---|
| **Express + REST** ✅ | Matches CPE241 lecture material. Routes / controllers / services maps 1:1 to the structure. Minimal magic. Smallest learning curve for the next teammate. |
| Fastify + REST | Faster + better schema validation, but the ecosystem isn't what students recognise. No win for a coursework demo. |
| NestJS | Decorators + DI is what an industry server looks like in 2026, but the layer of indirection makes "what does this 1 endpoint do" hard to trace in a 30-minute viva. Pass. |
| tRPC / Hono | Type-safe but they hide the controller pattern that the rubric wants to see. Pass. |

## Layered structure

```
apps/server/src/
├── routes/         # Express Router — declares paths + verbs only
├── controllers/    # parse req → call service → shape res
├── services/       # business logic + Prisma queries
├── models/         # response DTOs + zod request schemas
├── middleware/     # cors, error, logger, auth
├── db/             # Prisma client singleton
├── utils/          # AppError, helpers
└── app.ts          # buildApp() factory + listen()
```

One file per **resource per layer**. So `products` has:

- `routes/products.routes.ts`
- `controllers/products.controller.ts`
- `services/products.service.ts`
- `models/products.model.ts`

This deliberately mirrors the reference project the user pointed at
(`InvoiceDoc2`) so reviewers see the convention immediately.

## Walking through `GET /products?q=fonts` end to end

The single best example to memorise — every other endpoint follows
the same shape.

1. **`routes/products.routes.ts`** declares the path:
   ```ts
   const router = Router();
   router.get("/", ctrl.browse);
   ```
   `app.ts` mounts the router at `/products`, so the final URL is
   `GET /products`.

2. **`controllers/products.controller.ts`** validates the request,
   calls the service, returns JSON:
   ```ts
   export const browse: RequestHandler = async (req, res, next) => {
     try {
       const filters = browseQuerySchema.parse(req.query);
       const result = await service.findProducts(filters);
       res.json(result);
     } catch (err) { next(err); }
   };
   ```

3. **`models/products.model.ts`** owns the contract — `browseQuerySchema`
   for the request, `ProductBrowseResponse` for the response. zod
   schemas are re-exported from `@metu/shared` so the client uses
   the same definition.

4. **`services/products.service.ts`** runs the Prisma query, applies
   the public-catalogue gates (`isActive`, `deletedAt`, store
   `deletedAt`), shapes rows into the DTO. Knows nothing about
   Express.

5. **`db/prisma.ts`** — single Prisma client singleton the service
   imports.

6. Throws inside controllers / services are caught by **`middleware/error.ts`**
   and serialised as `{ error: code, message }`. A `throw new
   AppError(404, "ProductNotFound")` becomes a 404 JSON response.

## How to add a new endpoint (5-step template)

Say you want `GET /coupons/:code` (Phase 13.X · coupons module).

1. **Model** — `models/coupons.model.ts`. Define the response DTO +
   any zod request schema.
2. **Service** — `services/coupons.service.ts`. Add
   `findCouponByCode(code: string)` that runs the Prisma query +
   returns the DTO (or `null`).
3. **Controller** — `controllers/coupons.controller.ts`. Add
   `getOne` that parses `req.params.code`, calls the service, throws
   `AppError(404, "CouponNotFound")` when missing, returns JSON.
4. **Route** — `routes/coupons.routes.ts`. New `Router()`, add
   `router.get("/:code", ctrl.getOne)`.
5. **Mount** — in `app.ts`, `app.use("/coupons", couponsRoutes)`.
6. **Test** — `tests/coupons.test.ts` with one happy-path + one
   404 case using `vi.mock("../src/db/prisma.js")` + supertest.

## Local dev

```bash
# 1. Bring docker postgres up (root compose file)
npm run docker:up

# 2. Apply migrations
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# 3. From repo root, dev runs Next + Express side-by-side via concurrently
npm run dev
# web  → http://localhost:3000
# api  → http://localhost:4000

# Or just one:
npm run dev:server
npm run dev:web
```

Smoke checks:

```bash
curl -s http://localhost:4000/health
curl -s "http://localhost:4000/products?pageSize=2" | jq
curl -s http://localhost:4000/categories | jq
```

## Tests

```bash
npm test -w @metu/server
```

Each resource's test file mocks `prisma` at the top and drives
`buildApp()` via supertest — no port binding, no DB fixtures, runs
in ~2s.

## Deploy

Two Fly apps, sister to the BFF:

| App | URL | Config |
|---|---|---|
| `metu` | https://metu.fly.dev | `Dockerfile` + `fly.toml` |
| `metu-api` | https://metu-api.fly.dev | `apps/server/Dockerfile` + `fly.server.toml` |

```bash
flyctl deploy --config fly.server.toml --remote-only
```

`fly.server.toml` runs `prisma migrate deploy` in the release_command
so schema stays in sync without a manual SSH step.

The BFF picks the API base from `INTERNAL_API_URL` env (set on the
`metu` Fly app to `https://metu-api.fly.dev`).

## Open work — Phase 13.2+

Next migrations (each = one PR ≈ 200–400 LOC):

- 13.2 Auth (login / register / me / logout / change-password)
- 13.3 Cart (CRUD + coupon + checkout)
- 13.4 Orders (list / detail / mark-fulfilled / refund / export.csv)
- 13.5 Reviews (CRUD + admin moderate) — also unlocks the `minRating`
  HAVING-clause that today's BFF still has on direct Prisma
- 13.6 Q&A
- 13.7 Favorites + stock alerts + recently-viewed
- 13.8 Messages
- 13.9 Seller (analytics, products CRUD, coupons, bulk-edit)
- 13.10 Admin (users, stores, audit, reports, stats)

Final cleanup PR deletes whatever's left under `apps/web/app/api/**`,
making Next a pure UI/BFF.
