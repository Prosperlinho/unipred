import { Ban, CheckCircle2, Clock, Lock, Users } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { estimateBet, marketProbYes } from "@/lib/pool";
import { compactNaira, formatPct, timeLeft } from "@/lib/format";
import type { Market } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";

interface Props {
  market: Market;
  now: number;
  schoolLabel?: string;
  feeBps: number;
}

function MarketCardBase({ market, now, schoolLabel, feeBps }: Props) {
  const p = marketProbYes(market);
  // Estimated payout of a ₦1,000 bet on each side if betting closed now.
  const yesPays = estimateBet(market, "YES", 100_000, feeBps)?.payoutKobo ?? 0;
  const noPays = estimateBet(market, "NO", 100_000, feeBps)?.payoutKobo ?? 0;
  const pot = Number(market.stake_yes_kobo) + Number(market.stake_no_kobo);
  const hint = (pays: number, otherSide: number) => (otherSide > 0 ? `₦1k wins ~${compactNaira(pays)}` : "Be the first");
  const closesAt = new Date(market.closes_at).getTime();
  const closed = now >= closesAt;
  const urgent = !closed && closesAt - now < 24 * 3_600_000;
  const live = market.status === "open" && !closed;
  const href = `/markets/${market.id}`;

  const status =
    market.status === "resolved" ? (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
          market.resolution === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
        }`}
      >
        <CheckCircle2 className="size-3" /> {market.resolution}
      </span>
    ) : market.status === "cancelled" ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
        <Ban className="size-3" /> Cancelled
      </span>
    ) : (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
          urgent ? "bg-amber-400/15 text-amber-300" : closed ? "bg-white/5 text-muted" : "bg-brand/10 text-brand"
        }`}
      >
        {closed ? <Lock className="size-3" /> : live ? <span className="size-1.5 rounded-full bg-current" /> : <Clock className="size-3" />}
        {closed ? "Awaiting result" : timeLeft(closesAt, now)}
      </span>
    );
  const shownP = market.status === "resolved" ? (market.resolution === "YES" ? 1 : 0) : p;

  return (
    <article className="group/card flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-brand/30 hover:shadow-[0_0_0_1px_rgb(198_244_50/0.08),0_12px_40px_-12px_rgb(198_244_50/0.18)]">
      {/* Who / what / when, like a feed post header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {schoolLabel && (
            <span className="truncate text-[13px] font-bold text-cream">{schoolLabel}</span>
          )}
          <CategoryBadge category={market.category} />
        </div>
        {status}
      </div>

      <Link
        href={href}
        className="text-[15px] font-semibold leading-snug text-white hover:underline hover:decoration-white/30 hover:underline-offset-4"
      >
        {market.question}
      </Link>

      {/* Position-style panel: big odds on the left, money on the right */}
      <Link href={href} className="flex items-center justify-between gap-3 rounded-xl bg-bg/70 px-3.5 py-3 ring-1 ring-inset ring-white/5">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            Chance YES
            {live && <span className="size-1.5 rounded-full bg-brand" />}
          </span>
          <span className={`block text-2xl font-extrabold tabular-nums ${shownP >= 0.5 ? "text-yes" : "text-no"}`}>
            {formatPct(shownP)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-extrabold tabular-nums text-white">
            {market.engine === "pool" ? compactNaira(pot) : compactNaira(market.volume_kobo)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Users className="size-3" />
            {market.traders} {market.traders === 1 ? "trader" : "traders"} · {market.engine === "pool" ? "pot" : "vol"}
          </span>
        </span>
      </Link>

      <div
        className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`YES ${formatPct(shownP)}, NO ${formatPct(1 - shownP)}`}
      >
        <div className="rounded-l-full bg-yes" style={{ width: `${shownP * 100}%` }} />
        <div className="rounded-r-full bg-no" style={{ width: `${(1 - shownP) * 100}%` }} />
      </div>

      {live ? (
        <div className="grid grid-cols-2 gap-2" data-tour="bet">
          <Link
            href={`${href}?side=YES`}
            className="flex flex-col items-center rounded-xl bg-yes/12 py-2 text-center text-yes ring-1 ring-inset ring-yes/20 transition hover:bg-yes hover:text-black"
          >
            <span className="text-sm font-extrabold">Bet YES · {formatPct(p)}</span>
            <span className="text-[11px] tabular-nums opacity-80">{hint(yesPays, Number(market.stake_no_kobo))}</span>
          </Link>
          <Link
            href={`${href}?side=NO`}
            className="flex flex-col items-center rounded-xl bg-no/12 py-2 text-center text-no ring-1 ring-inset ring-no/20 transition hover:bg-no hover:text-black"
          >
            <span className="text-sm font-extrabold">Bet NO · {formatPct(1 - p)}</span>
            <span className="text-[11px] tabular-nums opacity-80">{hint(noPays, Number(market.stake_yes_kobo))}</span>
          </Link>
        </div>
      ) : (
        <Link
          href={href}
          className="rounded-xl border border-line py-2.5 text-center text-sm font-semibold text-muted transition hover:bg-card-2 hover:text-white"
        >
          View market
        </Link>
      )}
    </article>
  );
}

export const MarketCard = memo(MarketCardBase);
