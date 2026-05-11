-- Computed buyer + seller level per user. Replaces the static
-- user_stats.buyer_level / seller_level columns which were seeded
-- with random values and never recomputed.
--
-- Formula tuned so each tier has at least one resident on the demo
-- dataset (Macrohard / Ado at L3, mid-volume buyers at L4, etc.):
--
--   Seller level (settled orders + store.rating x10):
--     L5: >= 100 paid orders AND rating >= 4.5 AND >= THB 500K revenue
--     L4: >=  50 paid orders AND rating >= 4.3 AND >= THB 100K revenue
--     L3: >=  20 paid orders AND rating >= 4.0
--     L2: >=   5 paid orders
--     L1: default (just opened a store, or no sales yet)
--
--   Buyer level (settled orders + reviews authored):
--     L5: >= 50 paid orders OR >= THB 50K lifetime spent
--     L4: >= 20 paid orders OR >= THB 10K lifetime spent
--     L3: >=  5 paid orders AND >= 1 review written
--     L2: >=  1 paid order
--     L1: default
CREATE OR REPLACE VIEW v_user_level AS
SELECT
  u.user_id,
  CASE
    WHEN s.store_id IS NULL THEN NULL
    WHEN COALESCE(seller_agg.paid_orders, 0) >= 100
         AND s.rating >= 45
         AND COALESCE(seller_agg.revenue, 0) >= 500000 THEN 5
    WHEN COALESCE(seller_agg.paid_orders, 0) >= 50
         AND s.rating >= 43
         AND COALESCE(seller_agg.revenue, 0) >= 100000 THEN 4
    WHEN COALESCE(seller_agg.paid_orders, 0) >= 20
         AND s.rating >= 40 THEN 3
    WHEN COALESCE(seller_agg.paid_orders, 0) >= 5 THEN 2
    ELSE 1
  END AS seller_level,
  CASE
    WHEN COALESCE(buyer_agg.paid_orders, 0) >= 50
      OR COALESCE(buyer_agg.spent, 0) >= 50000 THEN 5
    WHEN COALESCE(buyer_agg.paid_orders, 0) >= 20
      OR COALESCE(buyer_agg.spent, 0) >= 10000 THEN 4
    WHEN COALESCE(buyer_agg.paid_orders, 0) >= 5
         AND COALESCE(buyer_agg.reviews, 0) >= 1 THEN 3
    WHEN COALESCE(buyer_agg.paid_orders, 0) >= 1 THEN 2
    ELSE 1
  END AS buyer_level,
  COALESCE(seller_agg.paid_orders, 0)::int AS seller_paid_orders,
  COALESCE(seller_agg.revenue, 0)::numeric AS seller_revenue,
  COALESCE(buyer_agg.paid_orders, 0)::int AS buyer_paid_orders,
  COALESCE(buyer_agg.spent, 0)::numeric AS buyer_spent,
  COALESCE(buyer_agg.reviews, 0)::int AS buyer_reviews
FROM users u
LEFT JOIN store s ON s.owner_id = u.user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT o.order_id) AS paid_orders,
    COALESCE(SUM(oi.price_per_unit * oi.quantity), 0) AS revenue
  FROM product p
  LEFT JOIN product_item pi ON pi.product_id = p.product_id
  LEFT JOIN order_item oi ON oi.product_item_id = pi.product_item_id
  LEFT JOIN orders o ON o.order_id = oi.order_id
                     AND o.status IN ('paid','fulfilled')
  WHERE p.store_id = s.store_id
) seller_agg ON s.store_id IS NOT NULL
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT o.order_id) AS paid_orders,
    COALESCE(SUM(o.total_price), 0) AS spent,
    (SELECT COUNT(*) FROM product_review pr WHERE pr.user_id = u.user_id) AS reviews
  FROM orders o
  WHERE o.user_id = u.user_id AND o.status IN ('paid','fulfilled')
) buyer_agg ON true;
