# Source Code Bug Review Plan

วันที่ตรวจ: 2026-05-02

## สรุปผลตรวจ

โปรเจกต์เป็น monorepo TypeScript/Next.js + Express API + Prisma. ชุด unit/API tests ผ่าน แต่ยังพบ bug และ risk ที่ test ปัจจุบันยังไม่ครอบคลุม โดยเฉพาะเส้นทาง cart/checkout, product listing, sitemap/SEO, deployment build script และ tooling.

## Verification ที่รันแล้ว

- `npm run test --workspaces --if-present`
  - `@metu/server`: 18 test files, 146 tests passed
  - `@metu/web`: 2 test files, 37 tests passed
- `npm run build --workspaces --if-present`
  - Build ผ่าน
  - มี warning/error ระหว่าง build:
    - `sitemap.xml` พยายามต่อ DB ที่ `localhost:5432` แล้ว fail แต่ถูก swallow
    - Sentry เตือนว่า `instrumentation-client.ts` ยังไม่ export `onRouterTransitionStart`
- `npm run lint -w @metu/web`
  - ไม่สามารถใช้ใน CI ได้ตอนนี้ เพราะ `next lint` เปิด interactive prompt ให้ configure ESLint แล้ว exit 1

## Findings และแผนแก้

### P1 - Cart/checkout bypass availability และ quantity cap

หลักฐาน:

- `apps/server/src/services/cart.service.ts:106` ดึง `productItem` จาก id โดยเลือกแค่ `deliveryMethod`, `quantity`, `productId`, `isStackable`, `store.ownerId`
- `apps/server/src/services/cart.service.ts:196` `updateItem()` ตรวจแค่เจ้าของ cart line แล้วเขียน `quantity: input.quantity` ตรง ๆ
- `apps/server/src/services/orders.service.ts:23` checkout โหลด cart items พร้อม `product: true` แต่ไม่มี re-check ว่า product/store ยังขายได้
- `apps/server/src/services/orders.service.ts:204` stock guard ใช้เฉพาะ non-digital delivery

ผลกระทบ:

- ผู้ใช้ที่รู้ `productItemId` อาจ add/checkout สินค้าที่ paused, soft-deleted, store suspended/deleted หรือ store ที่ไม่พร้อมรับเงินได้
- Digital item ถูก cap ที่ 1 ตอน `addItem()` แต่สามารถ PATCH cart line เป็นจำนวนมากกว่า 1 แล้ว checkout ได้
- Product ที่ถูก pause หลังอยู่ใน cart แล้วยังอาจ checkout ต่อได้

แผนแก้:

1. เพิ่ม helper กลาง เช่น `loadPurchasableProductItem(productItemId)` ที่ตรวจ:
   - product exists, `isActive = true`, `deletedAt = null`
   - store `deletedAt = null`, `suspendedAt = null`
   - ถ้าระบบ enforce Stripe readiness แล้ว ให้ตรวจ `stripeChargesEnabled`
   - stock/digital cap ที่ถูกต้อง
2. ใช้ helper นี้ใน `addItem()`
3. ปรับ `updateItem()` ให้โหลด product item ของ line เดิมแล้ว cap quantity ด้วย logic เดียวกับ add
4. เพิ่ม checkout re-validation ก่อนสร้าง order เพื่อกัน cart เก่าหรือ race หลัง seller pause product/store
5. เพิ่ม tests สำหรับ:
   - add paused/deleted/suspended product ต้อง fail
   - PATCH digital quantity > 1 ต้องถูก reject หรือ cap
   - checkout cart ที่ product ถูก pause หลัง add ต้อง fail

### P1 - Price sort paginate ก่อน sort จริง

หลักฐาน:

- `apps/server/src/services/products.service.ts:127` ใช้ `productId` เป็น fallback order สำหรับ `price_asc`
- `apps/server/src/services/products.service.ts:135` paginate ด้วย `take/skip`
- `apps/server/src/services/products.service.ts:139` ค่อย sort `items` ตาม `minPrice` หลังจาก paginate แล้ว
- pattern เดียวกันมีใน `apps/web/lib/server/queries.ts:330` และ `apps/web/lib/server/queries.ts:397` สำหรับ minRating branch

ผลกระทบ:

- `/products?sort=price_asc` และ `price_desc` ไม่ได้ sort ทั้ง result set จริง ๆ แต่ sort เฉพาะสินค้าที่ถูกเลือกมาใน page นั้น
- สินค้าราคาถูกกว่าอาจไปอยู่ page ถัดไป เพียงเพราะ `productId` สูงกว่า

แผนแก้:

1. ย้ายการ sort ราคาไปทำใน DB ก่อน paginate
2. ใช้ query aggregate จาก `product_item` เช่น `MIN(price * (1 - discount_percent / 100))`
3. paginate บน ordered product ids แล้วค่อย fetch card detail ตาม id list
4. เพิ่ม test dataset ที่ productId กับ price สวนทางกัน เพื่อจับ regression

### P1 - Sitemap ถูก build เป็น static และมี URL ผิด

หลักฐาน:

- `apps/web/app/sitemap.ts:25` ใส่ `${base}/features` แต่ route จริงคือ `/feature-tour`
- `apps/web/app/sitemap.ts:36` และ `apps/web/app/sitemap.ts:43` ดึง product/store จาก Prisma
- `apps/web/app/sitemap.ts:50` swallow DB error
- build output แสดง `○ /sitemap.xml` เป็น static prerendered content

ผลกระทบ:

- ตอน build ที่ไม่มี DB sitemap จะกลายเป็น static-only แล้ว product/store URLs หาย
- crawler ได้ URL `/features` ที่ 404

แผนแก้:

1. เพิ่ม `export const dynamic = "force-dynamic"` หรือ `export const revalidate = 3600` ตาม behavior ที่ต้องการ
2. แก้ `/features` เป็น `/feature-tour`
3. ใน production ควร log error ที่จับได้ หรือ fallback แบบ explicit เพื่อไม่กลบปัญหา DB
4. เพิ่ม test/smoke ที่เรียก `/sitemap.xml` แล้ว assert ว่าไม่มี `/features` และมี dynamic entries เมื่อ mock DB พร้อม

### P2 - Product detail rating/count นับจาก reviews ที่ถูก limit

หลักฐาน:

- `apps/web/lib/server/queries.ts:428` include `reviews`
- `apps/web/lib/server/queries.ts:432` จำกัด `take: 5`
- `apps/web/lib/server/queries.ts:441` คำนวณ rating จาก reviews ที่โหลดมา
- `apps/web/lib/server/queries.ts:443` คืน `reviewCount: ratings.length`
- API service มี pattern คล้ายกันที่ `apps/server/src/services/products.service.ts:193`, `apps/server/src/services/products.service.ts:195`, `apps/server/src/services/products.service.ts:218`

ผลกระทบ:

- Product detail แสดง average rating และจำนวน review ผิดเมื่อมี review มากกว่า 5 หรือ 20 รายการ
- UI อาจขึ้น “Showing 5 of 5” ทั้งที่มี review มากกว่านั้น

แผนแก้:

1. แยก query aggregate สำหรับ `_count` และ `_avg.rating`
2. จำกัดเฉพาะ `initialReviews` สำหรับ list ที่แสดงจริง แต่ไม่เอามาเป็น source ของ aggregate
3. เพิ่ม test สำหรับ product ที่มี review มากกว่า limit

### P2 - Product/detail และ related products ไม่ใช้ public-catalogue gate เดียวกัน

หลักฐาน:

- `apps/web/lib/server/queries.ts:412` `getProduct()` เช็คแค่ `deletedAt` ของ product/store แต่ไม่เช็ค `isActive`, `store.suspendedAt`, หรือ Stripe readiness
- `apps/web/lib/server/queries.ts:484` related products เช็ค `isActive` และ `deletedAt` แต่ไม่เช็ค `store.suspendedAt`
- `apps/server/src/services/products.service.ts:212` API detail เช็ค deleted/suspended store แต่ไม่เช็ค `product.isActive`

ผลกระทบ:

- สินค้าที่ seller pause แล้วอาจยังเปิด direct URL ได้
- related products อาจแสดงสินค้าจากร้านที่ suspended

แผนแก้:

1. สร้าง helper/filter กลางสำหรับ public catalogue gate
2. ใช้ filter เดียวกันใน list, featured, detail, related, sitemap และ cart/checkout
3. เพิ่ม tests สำหรับ direct product URL ของ paused product และ suspended store

### P2 - Build script กลบ migration failure

หลักฐาน:

- `apps/web/scripts/build.mjs:20` ถ้ามี DB URL จะรัน `prisma migrate deploy`
- `apps/web/scripts/build.mjs:32` catch error
- `apps/web/scripts/build.mjs:34` เตือนว่า migrate failed แต่ยัง continuing
- `apps/web/scripts/build.mjs:44` รัน `next build` ต่อ

ผลกระทบ:

- Production deploy อาจผ่านทั้งที่ migration fail ทำให้ runtime code เจอ schema เก่า
- Risk สูงมากเมื่อมี migration ที่ code ใหม่พึ่งพา

แผนแก้:

1. ถ้า `DATABASE_URL` หรือ `DATABASE_URL_UNPOOLED` ถูกตั้งใน CI/prod ให้ migration failure ทำให้ build fail
2. ถ้าต้องการ fallback local ให้ผูกกับ env ชัดเจน เช่น `ALLOW_MIGRATION_FAILURE=true`
3. เพิ่ม CI step แยกสำหรับ `prisma migrate deploy --schema=...`

### P3 - Sentry client navigation instrumentation ยังไม่ครบ

หลักฐาน:

- build warning จาก `@sentry/nextjs`
- `apps/web/instrumentation-client.ts:19` ตั้ง `dsn`
- `apps/web/instrumentation-client.ts:24` init Sentry ผ่าน dynamic import
- ไม่มี export `onRouterTransitionStart`

ผลกระทบ:

- Sentry client ยังจับ navigation tracing ไม่ครบตามที่ SDK ต้องการ

แผนแก้:

1. ปรับ `instrumentation-client.ts` ให้ export `onRouterTransitionStart`
2. ตรวจ bundle impact เพราะไฟล์นี้ตั้งใจ lazy-load SDK
3. ยืนยัน build warning หาย

### P3 - Lint script ใช้งานไม่ได้แบบ non-interactive

หลักฐาน:

- `apps/web/package.json:9` มี `"lint": "next lint"`
- `npm run lint -w @metu/web` เปิด prompt ให้ configure ESLint แล้ว exit 1

ผลกระทบ:

- CI หรือ reviewer รัน lint ไม่ได้
- Bug style/React hooks/a11y หลุดง่าย

แผนแก้:

1. เพิ่ม ESLint config ที่เหมาะกับ Next 14 เช่น `.eslintrc.json`
2. หรือเปลี่ยนเป็น eslint CLI config-based ถ้าจะ migrate ออกจาก `next lint`
3. เพิ่ม lint เข้า verification checklist

## Priority Roadmap

1. แก้ cart/checkout availability + quantity cap ก่อน เพราะกระทบการซื้อเงินจริงและ data integrity
2. แก้ product price sort เพราะเป็น user-facing correctness ชัดเจน
3. แก้ sitemap dynamic + `/feature-tour` เพื่อหยุด SEO 404 และ static sitemap ที่ข้อมูลหาย
4. แก้ rating/count aggregate และ public-catalogue gate ให้ทุก surface ใช้ rule เดียวกัน
5. ทำ build script ให้ fail เมื่อ migration fail ใน prod/CI
6. ปิด warning/tooling: Sentry hook + ESLint config

## Test Plan หลังแก้

- `npm run test --workspaces --if-present`
- `npm run build --workspaces --if-present`
- `npm run lint -w @metu/web`
- เพิ่ม server tests:
  - cart availability guard
  - cart update quantity cap
  - checkout revalidation
  - product price sort global pagination
  - product detail aggregate review count
- เพิ่ม web/server smoke:
  - `/sitemap.xml` ไม่มี `/features`
  - paused product direct URL เป็น 404
  - suspended store product ไม่โผล่ใน related/home/sitemap

## Open Questions

- Stripe readiness ควรเป็น hard gate ทุก public/product/cart surface เลยไหม หรือใช้ fallback แบบ `anyStoreReady` เฉพาะ browse/featured ต่อไป
- Sitemap ควร dynamic ทุก request หรือใช้ revalidate interval เช่น 1 ชั่วโมง
- Digital item quantity ควร reject ด้วย 400/409 หรือ silently cap เหมือน add flow ปัจจุบัน
