"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { priceOf, quoteBuy, quoteSell } from "@/lib/amm";
import { formatCP, formatPct, formatPrice, formatSigned } from "@/lib/format";
import type { Market, Outcome, TradeMode } from "@/lib/types";

interface Props {
  market: Market;
  initialSide: Outcome;
  initialMode: TradeMode;
  now: number;
}

const QUICK = [10, 50, 100] as const;

function floor2(n: number): number {
  return Math.floor(n * 100) / 100;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "yes" | "no" | "muted" }) {
  const cls = tone === "yes" ? "text-yes" : tone === "no" ? "text-no" : tone === "muted" ? "text-muted" : "text-white";
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

export function TradeBox({ market, initialSide, initialMode, now }: Props) {
  const { balance, getPosition, buy, sell } = useMarkets();
  const { toast } = useUI();
  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [side, setSide] = useState<Outcome>(initialSide);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const position = getPosition(market.id, side);
  const held = position?.shares ?? 0;
  const amount = Number.parseFloat(input);
  const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const closed = market.resolution !== null || now >= market.closesAt;

  const buyQuote = mode === "buy" ? quoteBuy(market, side, validAmount) : null;
  const sellQuote = mode === "sell" ? quoteSell(market, side, Math.min(validAmount, held)) : null;

  const price = priceOf(market, side);
  const maxValue = mode === "buy" ? floor2(balance) : floor2(held);

  let blocker: string | null = null;
  if (closed) blocker = market.resolution ? "Market resolved" : "Trading closed";
  else if (mode === "buy" && validAmount > balance + 1e-9) blocker = "Insufficient balance";
  else if (mode === "buy" && validAmount > 0 && validAmount < 1) blocker = "Minimum 1 CP";
  else if (mode === "sell" && held <= 0) blocker = `No ${side} shares to sell`;
  else if (mode === "sell" && validAmount > held + 1e-9) blocker = "Not enough shares";

  const canSubmit = !blocker && validAmount > 0 && (mode === "buy" ? !!buyQuote : !!sellQuote);

  const switchMode = (m: TradeMode) => {
    setMode(m);
    setInput("");
    setError(null);
  };

  const switchSide = (s: Outcome) => {
    setSide(s);
    setError(null);
    if (mode === "sell") setInput("");
  };

  const submit = () => {
    if (!canSubmit) return;
    if (mode === "buy") {
      const res = buy(market.id, side, validAmount);
      if (!res.ok) return setError(res.error);
      toast(`Bought ${formatCP(res.value.shares)} ${side} shares for ${formatCP(res.value.amount)} CP`);
    } else {
      const res = sell(market.id, side, validAmount);
      if (!res.ok) return setError(res.error);
      toast(`Sold ${formatCP(res.value.shares)} ${side} shares for ${formatCP(res.value.amount)} CP`);
    }
    setInput("");
    setError(null);
  };

  const sideBtn = (s: Outcome) => {
    const active = side === s;
    const p = priceOf(market, s);
    const activeCls = s === "YES" ? "bg-yes text-black" : "bg-no text-black";
    const idleCls = s === "YES" ? "bg-yes/10 text-yes hover:bg-yes/20" : "bg-no/10 text-no hover:bg-no/20";
    return (
      <button
        type="button"
        onClick={() => switchSide(s)}
        aria-pressed={active}
        className={`flex flex-col items-center rounded-xl py-2.5 font-semibold transition ${active ? activeCls : idleCls}`}
      >
        <span className="text-sm">{s}</span>
        <span className="text-xs tabular-nums opacity-80">{formatPrice(p)} CP</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl border border-line bg-card p-1">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
              mode === m ? "bg-card-2 text-white" : "text-muted hover:text-white"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sideBtn("YES")}
        {sideBtn("NO")}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <label htmlFor="trade-amount">{mode === "buy" ? "Stake (CP)" : `Shares to sell`}</label>
          <span className="tabular-nums">
            {mode === "buy" ? `Balance: ${formatCP(balance)} CP` : `Held: ${formatCP(held)} ${side}`}
          </span>
        </div>
        <div className="relative">
          <input
            id="trade-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={input}
            disabled={closed}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-3 pr-16 text-lg font-semibold tabular-nums text-white placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:opacity-50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {mode === "buy" ? "CP" : "shares"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={closed}
              onClick={() => {
                setInput(String(Math.min(q, maxValue)));
                setError(null);
              }}
              className="rounded-lg border border-line bg-card py-1.5 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            disabled={closed || maxValue <= 0}
            onClick={() => {
              setInput(String(maxValue));
              setError(null);
            }}
            className="rounded-lg border border-brand/40 bg-brand/10 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/20 disabled:opacity-40"
          >
            Max
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card px-3 py-2">
        {mode === "buy" ? (
          <>
            <Row label="Avg price / share" value={`${formatPrice(buyQuote?.avgPrice ?? price)} CP`} />
            <Row label="Est. shares" value={formatCP(buyQuote?.shares ?? 0)} />
            <Row
              label={`Potential payout if ${side}`}
              value={`${formatCP(buyQuote?.payout ?? 0)} CP`}
              tone={side === "YES" ? "yes" : "no"}
            />
            <Row
              label="Potential profit"
              value={buyQuote ? `${formatSigned(buyQuote.profit)} CP (${formatSigned(buyQuote.roi * 100)}%)` : "-"}
              tone="muted"
            />
          </>
        ) : (
          <>
            <Row label="Avg sell price" value={`${formatPrice(sellQuote?.avgPrice ?? price)} CP`} />
            <Row label="You receive" value={`${formatCP(sellQuote?.proceeds ?? 0)} CP`} />
            <Row
              label="Realized P&L"
              value={
                sellQuote && position
                  ? `${formatSigned(sellQuote.proceeds - position.costBasis * (sellQuote.shares / position.shares))} CP`
                  : "-"
              }
              tone={
                sellQuote && position
                  ? sellQuote.proceeds >= position.costBasis * (sellQuote.shares / position.shares)
                    ? "yes"
                    : "no"
                  : "muted"
              }
            />
          </>
        )}
        {(buyQuote || sellQuote) && (
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
            <span>YES odds after trade</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              {formatPct(priceOf(market, "YES"))}
              <ArrowRight className="size-3" />
              <span className="font-semibold text-white">
                {formatPct((buyQuote ?? sellQuote)?.probYesAfter ?? 0)}
              </span>
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-no" role="alert">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={`w-full rounded-xl py-3.5 text-base font-bold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted ${
          side === "YES" ? "bg-yes hover:brightness-110" : "bg-no hover:brightness-110"
        }`}
      >
        {blocker ??
          (validAmount > 0
            ? `${mode === "buy" ? "Buy" : "Sell"} ${side} · ${formatCP(
                mode === "buy" ? validAmount : sellQuote?.proceeds ?? 0,
              )} CP`
            : mode === "buy"
              ? "Enter a stake"
              : "Enter shares to sell")}
      </button>
      <p className="text-center text-[11px] text-muted">
        Each winning share pays 1 CP. Prices move with every trade (constant-product AMM).
      </p>
    </div>
  );
}
