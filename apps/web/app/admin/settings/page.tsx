import { Settings as SettingsIcon, Heart, Percent } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

/**
 * / 26 — admin settings page (slimmed down).
 * Shows the runtime feature flag + platform fee config plus a small
 * explainer card. Phase 26 dropped the wallet / chat / PromptPay
 * surfaces ; Phase 27 will expose Stripe Connect status here instead.
 */
export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <main id="main" className="px-8 py-8 max-w-4xl">
      <PageHeader
        title="System settings"
        subtitle="Runtime feature flags + platform fee configuration. Changes take effect within 30 seconds across both Fly machines."
      />

      <div className="mt-6 grid gap-6">
        <section className="rounded-2xl border border-line bg-space-900 p-6">
          <h2 className="font-display text-base font-bold text-white mb-3 flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-mint" />
            What these flags do
          </h2>
          <ul className="space-y-3 text-sm text-ink-secondary">
            <li className="flex items-start gap-3">
              <Heart className="h-4 w-4 text-coral shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Favorites enabled —</span>{" "}
                ON shows the TopNav heart icon, the FavoriteButton on every card, and the /favorites inbox.
                OFF hides them all. Existing favourite rows are preserved — flipping back ON immediately surfaces the user&#x2019;s prior favourites.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Percent className="h-4 w-4 text-metu-yellow shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Platform fee % —</span>{" "}
                The cut the platform takes from every order at checkout. Default 5 means a seller earns 95 baht for every 100-baht sale.
                Phase 27 wires this into Stripe&#x2019;s <code>application_fee_amount</code> parameter so the platform&#x2019;s share routes to the platform&#x2019;s Stripe account at charge time.
              </div>
            </li>
          </ul>
        </section>

        <SettingsForm initial={settings} />
      </div>
    </main>
  );
}
