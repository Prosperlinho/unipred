import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";
import { HeroBackground } from "@/components/hero/HeroBackground";
import { AutoRefresh } from "@/components/LiveRefresh";
import { LogoMark } from "@/components/Logo";
import { PersonalDeck } from "@/components/PersonalFeeds";
import { getRequestTime } from "@/lib/time";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getSettings } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { formatNaira } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Market } from "@/lib/types";

function trending(m: Market, now: number) {
  const ageHours = Math.max(1, (now - new Date(m.approved_at ?? m.created_at).getTime()) / 3_600_000);
  return (m.volume_kobo / 100 + m.traders * 200) / Math.pow(ageHours, 0.35);
}

export default async function HomePage() {
  if (!isSupabaseConfigured) return null;
  const [viewer, schools, settings] = await Promise.all([getViewer(), getActiveSchools(), getSettings()]);
  const now = getRequestTime();

  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .gt("closes_at", new Date(now).toISOString())
    .in("school_id", schools.map((s) => s.id))
    .limit(60);
  const markets = ((data ?? []) as Market[]).sort((a, b) => trending(b, now) - trending(a, now));
  const schoolLabels = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const bonus = settings.signup_bonus_kobo > 0 ? formatNaira(settings.signup_bonus_kobo) : null;

  return (
    <section className="relative overflow-hidden" aria-labelledby="home-title">
      <HeroBackground />
      <div className="absolute inset-0 bg-linear-to-b from-bg/40 via-bg/70 to-bg" aria-hidden />
      <AutoRefresh intervalMs={45_000} />

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-16 pt-6 lg:grid-cols-[1fr_420px] lg:gap-14 lg:pt-14">
        <div className="text-center lg:text-left">
          <p className="hidden items-center gap-2 text-sm font-medium text-brand lg:flex">
            <LogoMark className="h-5 w-auto" /> Your Campus. Your Calls.
          </p>
          <h1 id="home-title" className="font-serif text-3xl leading-[1.1] text-white sm:text-4xl lg:mt-4 lg:text-6xl">
            Swipe. Call it. <em className="italic text-brand">Get paid.</em>
          </h1>
          <p className="mt-3 hidden max-w-md text-lg text-white/75 lg:block">
            Right for YES, left for NO. The campus is betting, are you in?
          </p>

          {!viewer && bonus && (
            <Link
              href="/signup"
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand lg:mx-0"
            >
              <Gift className="size-4" /> Sign up and get {bonus} to play
              <ArrowRight className="size-4" />
            </Link>
          )}

          <div className="mt-6 hidden gap-3 lg:flex">
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-black transition hover:brightness-110"
            >
              All markets <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 font-medium text-white transition hover:bg-white/5"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        <div>
          <PersonalDeck
            saved={viewer?.profile.interests ?? null}
            markets={markets}
            feeBps={settings.pool_fee_bps}
            loggedIn={!!viewer}
            serverNow={now}
            schoolLabels={schoolLabels}
          />
          <p className="mt-5 text-center lg:hidden">
            <Link href="/markets" className="text-sm font-semibold text-brand">
              See all markets →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
