-- Phase 17.x — favoritesEnabled flag.
--
-- Adds a third runtime feature flag to the singleton system_setting
-- row. When OFF: TopNav heart icon, FavoriteButton on cards, and
-- the /favorites inbox all hide; the existing favorite_product
-- table stays intact so flipping the flag back ON immediately
-- surfaces the prior favourites with no data loss.
--
-- Default ON because every existing user currently sees the
-- favourites surfaces; flipping default OFF would silently
-- disappear an entire feature on next deploy.

ALTER TABLE "system_setting"
  ADD COLUMN "favorites_enabled" BOOLEAN NOT NULL DEFAULT true;
