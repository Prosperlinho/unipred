import type { Metadata } from "next";
import { HouseRules } from "@/components/HouseRules";
import { LegalPage } from "@/components/LegalPage";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "House Rules · UniPred" };

export default async function RulesPage() {
  const settings = await getSettings();
  return (
    <LegalPage
      title="House Rules"
      intro={
        <p>
          These rules apply to every market on UniPred. Every member reads and accepts them before using the platform,
          and they&apos;re shown again each time you place a bet.
        </p>
      }
    >
      <HouseRules feePct={settings.pool_fee_bps / 100} referralPct={settings.referral_share_bps / 100} />
    </LegalPage>
  );
}
