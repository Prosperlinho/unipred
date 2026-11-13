"use client";

import { Briefcase, CheckCircle2, Clock, Lock, PlusCircle, Trophy, XCircle } from "lucide-react";
import Link from "next/link";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { priceOf } from "@/lib/amm";
import { formatCP, formatPct, formatPrice, formatSigned, timeLeft } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Market, Position } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { ResolveSimulator } from "./ResolveSimulator";
import { PortfolioSkeleton } from "./Skeletons";

interface Row {
  position: Position;
  market: Market;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "yes" | "no" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === "yes" ? "text-yes" : tone === "no" ? "text-no" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
      {children}
      {count !== undefined && <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{count}</span>}
    </h2>
  );
}

export function Portfolio() {
  const { hydrated, balance, markets, positions, claim } = useMarkets();
  const { openMarket, toast, setCreateOpen } = useUI();
  const now = useNow();

  if (!hydrated) return <PortfolioSkeleton />;

  const byId = new Map(markets.map((m) => [m.id, m]));
  const rows: Row[] = positions
    .filter((p) => !p.claimed)
    .flatMap((position) => {
      const market = byId.get(position.marketId);
      if (!market) return [];
      const price = market.resolution ? (position.outcome === market.resolution ? 1 : 0) : priceOf(market, position.outcome);
      const value = position.shares * price;
      const pnl = value - position.costBasis;
      return [{ position, market, price, value, pnl, pnlPct: position.costBasis > 0 ? pnl / position.costBasis : 0 }];
    });

  const active = rows.filter((r) => !r.market.resolution);
  const settled = rows.filter((r) => r.market.resolution);
  const myMarkets = markets.filter((m) => m.createdByUser);

  const positionsValue = active.reduce((s, r) => s + r.value, 0);
  const unrealized = active.reduce((s, r) => s + r.pnl, 0);
  const claimable = settled.reduce((s, r) => s + r.value, 0);
  const netWorth = balance + positionsValue + claimable;

  const claimMarket = (marketId: string) => {
    const res = claim(marketId);
    if (!res.ok) return toast(res.error, "error");
    toast(
      res.value > 0 ? `Claimed ${formatCP(res.value)} CP into your balance` : "Position settled. Better luck next time.",
      res.value > 0 ? "success" : "info",
    );
  };

  const settledMarketIds = [...new Set(settled.map((r) => r.market.id))];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Cash balance" value={`${formatCP(balance)} CP`} />
        <SummaryCard label="Positions value" value={`${formatCP(positionsValue)} CP`} />
        <SummaryCard
          label="Unrealized P&L"
          value={`${formatSigned(unrealized)} CP`}
          tone={unrealized > 0.004 ? "yes" : unrealized < -0.004 ? "no" : undefined}
        />
        <SummaryCard label="Net worth" value={`${formatCP(netWorth)} CP`} />
      </section>

      {settledMarketIds.length > 0 && (
        <section className="space-y-3">
          <SectionTitle count={settledMarketIds.length}>Ready to settle</SectionTitle>
          {settledMarketIds.map((id) => {
            const market = byId.get(id);
            if (!market) return null;
            const mine = settled.filter((r) => r.market.id === id);
            const payout = mine.reduce((s, r) => s + r.value, 0);
            return (
              <div key={id} className="rounded-2xl border border-line bg-card p-4">
                <button
                  type="button"
                  onClick={() => openMarket(id)}
                  className="text-left text-sm font-semibold text-white hover:underline"
                >
                  {market.question}
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      market.resolution === "YES" ? "text-yes" : "text-no"
                    }`}
                  >
                    <CheckCircle2 className="size-3.5" /> Resolved {market.resolution}
                  </span>
                  {mine.map((r) => (
                    <span key={r.position.outcome} className="text-muted">
                      · {formatCP(r.position.shares)} {r.position.outcome}{" "}
                      {r.price > 0 ? (
                        <span className="text-yes">won</span>
                      ) : (
                        <span className="text-no">lost</span>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => claimMarket(id)}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                    payout > 0 ? "bg-brand text-black hover:brightness-110" : "border border-line text-muted hover:text-white"
                  }`}
                >
                  {payout > 0 ? (
                    <>
                      <Trophy className="size-4" /> Claim {formatCP(payout)} CP
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4" /> Dismiss losing position
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle count={active.length}>Active positions</SectionTitle>
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
            <Briefcase className="size-8 text-muted" />
            <p className="font-medium text-white">No open positions</p>
            <p className="text-sm text-muted">Pick a side on a market to start building your portfolio.</p>
            <Link
              href="/"
              className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((r) => {
              const closed = now >= r.market.closesAt;
              const avg = r.position.costBasis / r.position.shares;
              return (
                <article key={`${r.market.id}-${r.position.outcome}`} className="rounded-2xl border border-line bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={r.market.category} />
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      {closed ? <Lock className="size-3.5" /> : <Clock className="size-3.5" />}
                      {closed ? "Awaiting resolution" : timeLeft(r.market.closesAt, now)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openMarket(r.market.id, { side: r.position.outcome })}
                    className="mt-2 text-left text-sm font-semibold leading-snug text-white hover:underline"
                  >
                    {r.market.question}
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Side</span>
                      <span className={`font-bold ${r.position.outcome === "YES" ? "text-yes" : "text-no"}`}>
                        {r.position.outcome}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Shares</span>
                      <span className="tabular-nums text-white">{formatCP(r.position.shares)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Avg entry</span>
                      <span className="tabular-nums text-white">{formatPrice(avg)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Current</span>
                      <span className="tabular-nums text-white">
                        {formatPrice(r.price)} <span className="text-muted">({formatPct(r.price)})</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Value</span>
                      <span className="tabular-nums text-white">{formatCP(r.value)} CP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">P&amp;L</span>
                      <span className={`font-semibold tabular-nums ${r.pnl >= 0 ? "text-yes" : "text-no"}`}>
                        {formatSigned(r.pnl)} ({formatSigned(r.pnlPct * 100)}%)
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={closed}
                      onClick={() => openMarket(r.market.id, { side: r.position.outcome, mode: "buy" })}
                      className="rounded-lg border border-line py-2 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
                    >
                      Buy more
                    </button>
                    <button
                      type="button"
                      disabled={closed}
                      onClick={() => openMarket(r.market.id, { side: r.position.outcome, mode: "sell" })}
                      className="rounded-lg border border-line py-2 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
                    >
                      Sell
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle count={myMarkets.length}>Markets you created</SectionTitle>
        {myMarkets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
            <PlusCircle className="size-8 text-muted" />
            <p className="font-medium text-white">You haven&apos;t created any markets</p>
            <p className="max-w-xs text-sm text-muted">
              Create one to try the resolution simulator: settle it YES or NO and claim your payout.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
            >
              + Create Market
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myMarkets.map((m) => (
              <article key={m.id} className="space-y-3 rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <CategoryBadge category={m.category} />
                  {m.resolution ? (
                    <span className={`text-xs font-semibold ${m.resolution === "YES" ? "text-yes" : "text-no"}`}>
                      Resolved {m.resolution}
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums text-muted">
                      YES {formatPct(priceOf(m, "YES"))} · {formatCP(m.volume)} CP vol
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openMarket(m.id)}
                  className="text-left text-sm font-semibold leading-snug text-white hover:underline"
                >
                  {m.question}
                </button>
                <ResolveSimulator market={m} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
