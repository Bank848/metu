-- Replace broken samples.metu.dev URLs with the product's first image
-- scaled down to 480x320 as a working preview.

UPDATE "product_item" pi
SET "sample_url" = REPLACE(
  REPLACE(img.url, 'w=1200', 'w=480'),
  'h=800', 'h=320'
)
FROM (
  SELECT DISTINCT ON (p."product_id")
    p."product_id",
    pi2."product_image" AS url
  FROM "product" p
  JOIN "product_image" pi2 ON pi2."product_id" = p."product_id"
  ORDER BY p."product_id", pi2."sort_order" ASC
) img
WHERE pi."product_id" = img."product_id"
  AND pi."sample_url" LIKE 'https://samples.metu.dev/%';
