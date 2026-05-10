-- Add a runtime toggle for the gift-checkout feature so an admin can
-- disable the "🎁 This is a gift" path from /admin/settings without
-- a redeploy. DEFAULT true preserves existing behavior for in-flight
-- carts; the BFF/API read this flag through the cached
-- SystemSetting row that already gates favorites + platform fee.
ALTER TABLE "system_setting"
  ADD COLUMN "gifting_enabled" BOOLEAN NOT NULL DEFAULT true;
