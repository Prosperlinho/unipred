"use client";

import { CheckCircle2, Clock, Info, Lock, Trophy, Users, Waves, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI, type DrawerTarget } from "@/context/UIContext";
import { probYes } from "@/lib/amm";
import { compactCP, formatCP, formatDate, formatPct, formatSigned, timeLeft } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Market } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { Comments } from "./Comments";
import { ProbabilityBar } from "./ProbabilityBar";
import { ResolveSimulator } from "./ResolveSimulator";
import { Sheet } from "./Sheet";
import { Sparkline } from "./Sparkline";
import { TradeBox } from "./TradeBox";

type Tab = DrawerTarget["tab"];

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function SettledPanel({ market }: { market: Market }) {
  const { positions, claim } = useMarkets();
  const { toast } = useUI();
  const mine = positions.filter((p) => p.marketId === market.id && !p.claimed);
  const winnings = mine.filter((p) => p.outcome === market.resolution).reduce((s, p) => s + p.shares, 0);
  const won = market.resolution === "YES";

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 rounded-xl p-4 ${won ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}
      >
        <CheckCircle2 className="size-6 shrink-0" />
        <div>
          <p className="font-bold">Resolved {market.resolution}</p>
          {market.resolvedAt && <p className="text-xs opacity-80">{formatDate(market.resolvedAt)}</p>}
        </div>
      </div>
      {mine.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const res = claim(market.id);
            if (!res.ok) return toast(res.error, "error");
            toast(
              res.value > 0 ? `Claimed ${formatCP(res.value)} CP into your balance` : "Position settled. Better luck next time.",
              res.value > 0 ? "success" : "info",
            );
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110"
        >
          <Trophy className="size-4" />
          {winnings > 0 ? `Claim ${formatCP(winnings)} CP` : "Settle losing position"}
        </button>
      )}
    </div>
  );
}

function DrawerBody({ market, target }: { market: Market; target: DrawerTarget }) {
  const now = useNow(15_000);
  const { positions } = useMarkets();
  const [tab, setTab] = useState<Tab>(target.tab);
  const p = probYes(market);
  const first = market.history[0]?.p ?? p;
  const change = p - first;
  const closed = now >= market.closesAt;
  const myPositions = positions.filter((pos) => pos.marketId === market.id && !pos.claimed);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={market.category} />
          {market.createdByUser && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Created by you
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold leading-snug text-white">{market.question}</h3>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold tabular-nums text-white">
            {formatPct(market.resolution ? (market.resolution === "YES" ? 1 : 0) : p)}
            <span className="ml-1.5 text-sm font-medium text-muted">chance YES</span>
          </p>
          {!market.resolution && Math.abs(change) >= 0.005 && (
            <p className={`text-xs font-semibold tabular-nums ${change >= 0 ? "text-yes" : "text-no"}`}>
              {change >= 0 ? "▲" : "▼"} {formatPct(Math.abs(change))} since open
            </p>
          )}
        </div>
      </div>

      <Sparkline points={market.history} height={88} />
      <ProbabilityBar probYes={market.resolution ? (market.resolution === "YES" ? 1 : 0) : p} size="lg" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={closed || market.resolution ? Lock : Clock}
          label={market.resolution ? "Status" : "Closes"}
          value={market.resolution ? "Resolved" : timeLeft(market.closesAt, now)}
        />
        <Stat icon={TrendingUp} label="Volume" value={`${compactCP(market.volume)} CP`} />
        <Stat icon={Waves} label="Liquidity" value={`${compactCP(market.poolYes + market.poolNo)}`} />
        <Stat icon={Users} label="Traders" value={compactCP(market.traders)} />
      </div>

      {myPositions.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-line p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your position</p>
          {myPositions.map((pos) => {
            const price = market.resolution ? (pos.outcome === market.resolution ? 1 : 0) : pos.outcome === "YES" ? p : 1 - p;
            const value = pos.shares * price;
            const pnl = value - pos.costBasis;
            return (
              <div key={pos.outcome} className="flex items-center justify-between text-sm">
                <span>
                  <span className={pos.outcome === "YES" ? "font-bold text-yes" : "font-bold text-no"}>{pos.outcome}</span>{" "}
                  <span className="tabular-nums text-white">{formatCP(pos.shares)} shares</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-white">{formatCP(value)} CP</span>{" "}
                  <span className={pnl >= 0 ? "text-yes" : "text-no"}>({formatSigned(pnl)})</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ResolveSimulator market={market} />

      <div className="flex gap-1 border-b border-line" role="tablist">
        {(
          [
            ["trade", market.resolution ? "Settlement" : "Trade"],
            ["banter", `Campus Banter (${market.comments.length})`],
            ["rules", "Rules"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === key ? "border-brand text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "trade" &&
        (market.resolution ? (
          <SettledPanel market={market} />
        ) : (
          <TradeBox market={market} initialSide={target.side} initialMode={target.mode} now={now} />
        ))}
      {tab === "banter" && <Comments market={market} now={now} />}
      {tab === "rules" && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-card p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Info className="size-3.5" /> Resolution criteria
            </p>
            <p className="leading-relaxed text-white/90">{market.criteria}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-card p-3 text-xs">
            <dt className="text-muted">Source</dt>
            <dd className="text-white">{market.source}</dd>
            <dt className="text-muted">Closes</dt>
            <dd className="text-white">{formatDate(market.closesAt)}</dd>
            <dt className="text-muted">Created</dt>
            <dd className="text-white">{formatDate(market.createdAt)}</dd>
            <dt className="text-muted">Creator</dt>
            <dd className="text-white">{market.creator}</dd>
            <dt className="text-muted">Creator bond</dt>
            <dd className="text-white">{market.creatorBond} CP</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export function MarketDrawer() {
  const { drawer, closeMarket } = useUI();
  const { getMarket } = useMarkets();
  const market = drawer ? getMarket(drawer.marketId) : undefined;

  return (
    <Sheet open={!!drawer && !!market} onClose={closeMarket} title="Market" wide>
      {drawer && market && (
        <DrawerBody
          key={`${drawer.marketId}-${drawer.side}-${drawer.mode}-${drawer.tab}`}
          market={market}
          target={drawer}
        />
      )}
    </Sheet>
  );
}
