-- Phase 42 - backfill sample_url, delivery_url, license_key_template on
-- product_item rows that the original seed missed. Without this, the
-- "Free sample" link on /product/<id> stays hidden and finalize_order
-- has no URL to deliver after a paid checkout.
--
-- Strategy: build a slug from the product name (lower-case alphanum,
-- collapse runs of non-alphanum to "-"), pick a believable file
-- extension based on category, and fill the URL/template per
-- delivery_method. Rows that already have a value are left alone.

UPDATE "product_item" pi
SET
  "sample_url" = COALESCE(
    pi."sample_url",
    'https://samples.metu.dev/'
      || regexp_replace(
           regexp_replace(
             regexp_replace(lower(p."name"), '\([^)]*\)', '', 'g'),
             '[^a-z0-9]+', '-', 'g'
           ),
           '^-+|-+$', '', 'g'
         )
      || '-preview.'
      || CASE c."category_name"
           WHEN 'Stock Music'      THEN 'mp3'
           WHEN 'Sound Effects'    THEN 'mp3'
           WHEN 'Stock Photos'     THEN 'jpg'
           WHEN 'Illustrations'    THEN 'jpg'
           WHEN 'Icons'            THEN 'jpg'
           WHEN 'UI Kits'          THEN 'jpg'
           WHEN 'Fonts'            THEN 'jpg'
           WHEN 'Video Templates'  THEN 'mp4'
           WHEN 'Motion Graphics'  THEN 'mp4'
           WHEN '3D Models'        THEN 'glb'
           ELSE 'pdf'
         END
  ),
  "delivery_url" = COALESCE(
    pi."delivery_url",
    CASE pi."delivery_method"
      WHEN 'download' THEN
        'https://files.metu.dev/'
          || regexp_replace(
               regexp_replace(
                 regexp_replace(lower(p."name"), '\([^)]*\)', '', 'g'),
                 '[^a-z0-9]+', '-', 'g'
               ),
               '^-+|-+$', '', 'g'
             )
          || '.zip'
      WHEN 'streaming' THEN
        'https://stream.metu.dev/'
          || regexp_replace(
               regexp_replace(
                 regexp_replace(lower(p."name"), '\([^)]*\)', '', 'g'),
                 '[^a-z0-9]+', '-', 'g'
               ),
               '^-+|-+$', '', 'g'
             )
          || '/index.m3u8'
      ELSE NULL
    END
  ),
  "license_key_template" = COALESCE(
    pi."license_key_template",
    CASE pi."delivery_method"
      WHEN 'license_key' THEN 'METU-XXXX-XXXX-XXXX'
      WHEN 'email'       THEN 'METU-EMAIL-XXXX'
      ELSE NULL
    END
  )
FROM "product" p, "category" c
WHERE pi."product_id" = p."product_id"
  AND p."category_id" = c."category_id";
