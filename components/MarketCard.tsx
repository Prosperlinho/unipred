"use client";

import { CheckCircle2, Clock, Lock, MessageCircle, TrendingUp, UserRound } from "lucide-react";
import { memo } from "react";
import { probYes } from "@/lib/amm";
import { compactCP, formatPrice, timeLeft } from "@/lib/format";
import type { Market, Outcome } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { ProbabilityBar } from "./ProbabilityBar";

interface Props {
  market: Market;
  now: number;
  onOpen: (marketId: string, side?: Outcome) => void;
}

function MarketCardBase({ market, now, onOpen }: Props) {
  const p = probYes(market);
  const closed = now >= market.closesAt;
  const msLeft = market.closesAt - now;
  const urgent = !closed && msLeft < 24 * 3_600_000;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-white/15">
      <div className="flex items-center justify-between gap-2">
        <CategoryBadge category={market.category} />
        {market.resolution ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              market.resolution === "YES" ? "text-yes" : "text-no"
            }`}
          >
            <CheckCircle2 className="size-3.5" /> Resolved {market.resolution}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 text-xs tabular-nums ${
              closed ? "text-muted" : urgent ? "text-amber-300" : "text-muted"
            }`}
          >
            {closed ? <Lock className="size-3.5" /> : <Clock className="size-3.5" />}
            {closed ? "Awaiting resolution" : timeLeft(market.closesAt, now)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(market.id)}
        className="text-left text-[15px] font-semibold leading-snug text-white hover:underline hover:decoration-white/30 hover:underline-offset-4"
      >
        {market.question}
      </button>

      <ProbabilityBar probYes={p} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="size-3.5" />
          {compactCP(market.volume)} CP vol
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3.5" />
          {market.comments.length}
        </span>
        {market.createdByUser && (
          <span className="ml-auto inline-flex items-center gap-1 text-brand">
            <UserRound className="size-3.5" />
            Your market
          </span>
        )}
      </div>

      {market.resolution || closed ? (
        <button
          type="button"
          onClick={() => onOpen(market.id)}
          className="rounded-xl border border-line py-2.5 text-sm font-semibold text-muted transition hover:bg-card-2 hover:text-white"
        >
          View market
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpen(market.id, "YES")}
            className="rounded-xl bg-yes/15 py-2.5 text-sm font-semibold text-yes transition hover:bg-yes hover:text-black active:scale-[0.98]"
          >
            Buy YES <span className="tabular-nums opacity-80">{formatPrice(p)}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpen(market.id, "NO")}
            className="rounded-xl bg-no/15 py-2.5 text-sm font-semibold text-no transition hover:bg-no hover:text-black active:scale-[0.98]"
          >
            Buy NO <span className="tabular-nums opacity-80">{formatPrice(1 - p)}</span>
          </button>
        </div>
      )}
    </article>
  );
}

export const MarketCard = memo(MarketCardBase);
