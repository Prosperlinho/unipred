import { connection } from "next/server";
import type { ReactNode } from "react";
import { UIProvider } from "@/context/UIContext";
import { ShieldAlert } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getLiveBanners, getSettings } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { HouseRules } from "./HouseRules";
import { RulesGate } from "./RulesGate";
import { WelcomeGuide } from "./WelcomeGuide";
import { TourHost } from "./Tour";
import type { GuideInfo } from "./Guide";
import { SUPPORT_EMAIL } from "./LegalPage";
import { formatNaira } from "@/lib/format";
import { Toaster } from "./Toaster";
import { PwaSetup } from "./AppAlerts";
import { PullToRefresh } from "./PullToRefresh";
import { NotificationsGate } from "./NotificationsGate";
import { SponsorCarousel } from "./SponsorCarousel";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({ children }: { children: ReactNode }) {
  // Every page is personal (balance, session), so always render per request.
  await connection();
  const [viewer, settings, sponsorBanners] = await Promise.all([getViewer(), getSettings(), getLiveBanners()]);
  let unread = 0;
  if (viewer) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .is("read_at", null);
    unread = count ?? 0;
  }
  const profile = viewer?.profile;
  // Columns are undefined until migration 0006 runs; only gate when they exist.
  const needsRules = !!profile && typeof profile.terms_version === "number" && profile.terms_version < settings.terms_version;
  const guide: GuideInfo = {
    feePct: settings.pool_fee_bps / 100,
    exitFeePct: settings.exit_fee_bps / 100,
    referralPct: settings.referral_share_bps / 100,
    minBet: formatNaira(settings.min_trade_kobo),
    minDeposit: formatNaira(settings.min_deposit_kobo),
    minWithdrawal: formatNaira(settings.min_withdrawal_kobo),
    supportEmail: SUPPORT_EMAIL,
  };
  const showWelcome = !!profile && !needsRules && profile.onboarded_at === null;

  return (
    <UIProvider>
      <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
        <Header
          guide={guide}
          viewer={
            viewer
              ? {
                  username: viewer.profile.username,
                  balanceKobo: viewer.balanceKobo,
                  isAdmin: viewer.profile.is_admin,
                  canPropose: !!viewer.profile.can_propose || viewer.profile.is_admin,
                  unread,
                }
              : null
          }
        />
        {sponsorBanners.length > 0 && (
          // Pinned under the header: stays on screen while scrolling, swipes through every sponsor.
          <div className="sticky top-14 z-30 bg-bg/95 px-3 py-2 backdrop-blur sm:px-4" role="region" aria-label="Sponsors">
            <SponsorCarousel banners={sponsorBanners} compact className="mx-auto max-w-3xl" />
          </div>
        )}
        {profile?.is_banned && (
          <div className="flex items-start justify-center gap-2 bg-no/15 px-4 py-2 text-center text-xs font-medium text-no">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Your account is suspended pending review. Trading, proposals and withdrawals are disabled. Contact UniPred support.
          </div>
        )}
        <main className="w-full flex-1">
          {isSupabaseConfigured ? (
            children
          ) : (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
              <h1 className="text-xl font-bold text-white">Almost ready</h1>
              <p className="mt-2 text-sm text-muted">
                UniPred needs its Supabase keys. Add <code className="text-brand">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="text-brand">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment (see{" "}
                <code>docs/SETUP.md</code>), then restart.
              </p>
            </div>
          )}
        </main>
        <Footer />
      </div>
      <BottomNav loggedIn={!!viewer} />
      {needsRules && (
        <RulesGate>
          <HouseRules
            feePct={settings.pool_fee_bps / 100}
            exitFeePct={settings.exit_fee_bps / 100}
            referralPct={settings.referral_share_bps / 100}
            compact
          />
        </RulesGate>
      )}
      {showWelcome ? <WelcomeGuide /> : <TourHost />}
      {viewer && !needsRules && !showWelcome && <NotificationsGate />}
      <PwaSetup />
      <PullToRefresh />
      <Toaster />
    </UIProvider>
  );
}
