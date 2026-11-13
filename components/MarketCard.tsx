import { Ban, CheckCircle2, Clock, Lock, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { SHARE_VALUE_KOBO, probYes } from "@/lib/amm";
import { compactNaira, formatNaira, timeLeft } from "@/lib/format";
import type { Market } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { ProbabilityBar } from "./ProbabilityBar";

interface Props {
  market: Market;
  now: number;
  schoolLabel?: string;
}

function MarketCardBase({ market, now, schoolLabel }: Props) {
  const p = probYes(market);
  const closesAt = new Date(market.closes_at).getTime();
  const closed = now >= closesAt;
  const urgent = !closed && closesAt - now < 24 * 3_600_000;
  const live = market.status === "open" && !closed;
  const href = `/markets/${market.id}`;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-white/15">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <CategoryBadge category={market.category} />
          {schoolLabel && (
            <span className="truncate rounded-full bg-brand-gold/10 px-2 py-0.5 text-[11px] font-semibold text-brand-gold">
              {schoolLabel}
            </span>
          )}
        </div>
        {market.status === "resolved" ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
              market.resolution === "YES" ? "text-yes" : "text-no"
            }`}
          >
            <CheckCircle2 className="size-3.5" /> {market.resolution}
          </span>
        ) : market.status === "cancelled" ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
            <Ban className="size-3.5" /> Cancelled
          </span>
        ) : (
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-xs tabular-nums ${
              urgent ? "text-amber-300" : "text-muted"
            }`}
          >
            {closed ? <Lock className="size-3.5" /> : <Clock className="size-3.5" />}
            {closed ? "Awaiting result" : timeLeft(closesAt, now)}
          </span>
        )}
      </div>

      <Link
        href={href}
        className="text-[15px] font-semibold leading-snug text-white hover:underline hover:decoration-white/30 hover:underline-offset-4"
      >
        {market.question}
      </Link>

      <ProbabilityBar probYes={market.status === "resolved" ? (market.resolution === "YES" ? 1 : 0) : p} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="size-3.5" />
          {compactNaira(market.volume_kobo)} vol
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" />
          {market.traders}
        </span>
      </div>

      {live ? (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`${href}?side=YES`}
            className="rounded-xl bg-yes/15 py-2.5 text-center text-sm font-semibold text-yes transition hover:bg-yes hover:text-black"
          >
            Buy YES <span className="tabular-nums opacity-80">{formatNaira(p * SHARE_VALUE_KOBO)}</span>
          </Link>
          <Link
            href={`${href}?side=NO`}
            className="rounded-xl bg-no/15 py-2.5 text-center text-sm font-semibold text-no transition hover:bg-no hover:text-black"
          >
            Buy NO <span className="tabular-nums opacity-80">{formatNaira((1 - p) * SHARE_VALUE_KOBO)}</span>
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
