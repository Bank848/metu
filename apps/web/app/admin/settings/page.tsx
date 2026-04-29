import { Settings as SettingsIcon, Wallet, MessageSquare, QrCode, Heart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

/**
 * Phase 17.1 — admin settings page.
 *
 * Shows the three runtime feature flags (walletEnabled, chatEnabled,
 * promptpayId) plus a small explainer card describing what each one
 * does and what surfaces hide/show when toggled.
 *
 * Sits behind the admin layout's role gate so non-admins never reach
 * it. Reads the live settings via the BFF helper (server cached
 * 30 s on the API side); the SettingsForm client component does the
 * PATCH.
 */
export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <main id="main" className="px-8 py-8 max-w-4xl">
      <PageHeader
        title="System settings"
        subtitle="Runtime feature flags + PromptPay configuration. Changes take effect within 30 seconds across both Fly machines."
      />

      <div className="mt-6 grid gap-6">
        {/* Hand-coded "info card" explaining what each flag does. */}
        <section className="rounded-2xl border border-line bg-space-900 p-6">
          <h2 className="font-display text-base font-bold text-white mb-3 flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-mint" />
            What these flags do
          </h2>
          <ul className="space-y-3 text-sm text-ink-secondary">
            <li className="flex items-start gap-3">
              <Wallet className="h-4 w-4 text-metu-yellow shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Wallet enabled —</span>{" "}
                ON makes checkout require the buyer to spend coins from their wallet (top-up via PromptPay first).
                OFF lets every buyer place orders without a balance check (demo mode — like Phase 13's seed-data flow).
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-mint shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Chat enabled —</span>{" "}
                ON shows the chat icon, /messages inbox, and "Message store" CTAs everywhere.
                OFF hides all chat surfaces and falls back to email + the order receipt page for delivery.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Heart className="h-4 w-4 text-coral shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Favorites enabled —</span>{" "}
                ON shows the TopNav heart icon, the FavoriteButton on every card, and the /favorites inbox.
                OFF hides them all. Existing favourite rows are preserved — flipping back ON immediately surfaces the user's prior favourites.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <QrCode className="h-4 w-4 text-coral shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">PromptPay ID —</span>{" "}
                The phone number / national ID that top-up QR codes will charge. Use a real PromptPay-registered ID for production demo;
                the default seed value is a placeholder.
              </div>
            </li>
          </ul>
        </section>

        <SettingsForm initial={settings} />
      </div>
    </main>
  );
}
