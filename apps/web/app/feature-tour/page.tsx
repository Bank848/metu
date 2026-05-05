import { Kiosk } from "./Kiosk";
import { getKioskData } from "@/lib/server/kiosk";

// Kiosk mode — auto-cycling slideshow for an unattended display
// (presentation day, hallway monitor). Server component fetches fresh
// data on every render; the client Kiosk calls router.refresh() after
// every full slide loop so live metrics keep breathing without a
// dedicated polling endpoint.
//
// Operator controls: Space pauses, arrow keys step, R refreshes,
// `?paused=1` pins the loop on the current slide for Q&A.

export const metadata = {
  title: "METU · Live demo",
  description:
    "An auto-cycling overview of the METU marketplace — live metrics, the database map, and the tech stack.",
};

export const dynamic = "force-dynamic";

export default async function FeatureTourPage() {
  const data = await getKioskData();
  return <Kiosk data={data} />;
}
