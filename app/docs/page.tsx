import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { GuideDocs, type GuideInfo } from "@/components/Guide";
import { SUPPORT_EMAIL } from "@/components/LegalPage";
import { getSettings } from "@/lib/data";
import { formatNaira } from "@/lib/format";

export const metadata: Metadata = {
  title: "Docs · UniPred",
  description: "How UniPred works: trading, prices, cash-out, wallet, streaks, tasks, rooms, prizes and safety.",
};

export default async function DocsPage() {
  const settings = await getSettings();
  const info: GuideInfo = {
    feePct: settings.pool_fee_bps / 100,
    exitFeePct: settings.exit_fee_bps / 100,
    referralPct: settings.referral_share_bps / 100,
    minBet: formatNaira(settings.min_trade_kobo),
    minDeposit: formatNaira(settings.min_deposit_kobo),
    minWithdrawal: formatNaira(settings.min_withdrawal_kobo),
    supportEmail: SUPPORT_EMAIL,
  };
  return (
    <Container>
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">UniPred Docs</p>
        <h1 className="mt-1 font-serif text-3xl text-white sm:text-4xl">How UniPred works</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Everything about trading on campus questions: funding your wallet, prices and shares, cashing out, results, streaks,
          tasks, rooms and staying safe. Numbers on this page come straight from the live settings.
        </p>
      </header>
      <GuideDocs info={info} />
    </Container>
  );
}
