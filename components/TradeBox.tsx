"use client";

import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { buyShares, sellShares } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { SHARE_VALUE_KOBO, priceOf, quoteBuy, quoteSell } from "@/lib/amm";
import { formatNaira, formatPct, formatShares, formatSignedNaira, formatSignedPct } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Outcome, Pools, TradeMode } from "@/lib/types";

export interface Holding {
  shares: number;
  cost_kobo: number;
}

interface Props {
  marketId: string;
  pools: Pools;
  closesAt: string;
  feeBps: number;
  minTradeKobo: number;
  balanceKobo: number | null;
  holdings: Partial<Record<Outcome, Holding>>;
  initialSide: Outcome;
  serverNow: number;
}

const QUICK_NAIRA = [500, 1000, 2000, 5000] as const;
const SLIPPAGE = 0.98; // reject if price moves more than 2% before execution

function Row({ label, value, tone }: { label: string; value: string; tone?: "yes" | "no" | "muted" }) {
  const cls = tone === "yes" ? "text-yes" : tone === "no" ? "text-no" : tone === "muted" ? "text-muted" : "text-white";
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

export function TradeBox(props: Props) {
  const { marketId, pools, feeBps, minTradeKobo, balanceKobo, holdings } = props;
  const { toast } = useUI();
  const now = useNow(props.serverNow, 15_000);
  const [mode, setMode] = useState<TradeMode>("buy");
  const [side, setSide] = useState<Outcome>(props.initialSide);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loggedIn = balanceKobo !== null;
  const balance = balanceKobo ?? 0;
  const holding = holdings[side];
  const held = holding?.shares ?? 0;
  const closed = now >= new Date(props.closesAt).getTime();

  const num = Number.parseFloat(input);
  const value = Number.isFinite(num) && num > 0 ? num : 0;
  const amountKobo = mode === "buy" ? Math.round(value * 100) : 0;
  const sellAmount = mode === "sell" ? Math.min(value, held) : 0;

  const buyQ = mode === "buy" ? quoteBuy(pools, side, amountKobo, feeBps) : null;
  const sellQ = mode === "sell" ? quoteSell(pools, side, sellAmount, feeBps) : null;
  const price = priceOf(pools, side);

  let blocker: string | null = null;
  if (closed) blocker = "Trading closed";
  else if (mode === "buy" && amountKobo > balance) blocker = "Insufficient balance";
  else if (mode === "buy" && amountKobo > 0 && amountKobo < minTradeKobo) blocker = `Minimum ${formatNaira(minTradeKobo)}`;
  else if (mode === "sell" && held <= 0) blocker = `No ${side} shares to sell`;
  else if (mode === "sell" && value > held + 1e-9) blocker = "Not enough shares";
  const canSubmit = !blocker && !pending && (mode === "buy" ? !!buyQ : !!sellQ);

  const sellCostShare = holding && sellQ ? Math.round(holding.cost_kobo * (sellQ.shares / holding.shares)) : 0;

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      if (mode === "buy" && buyQ) {
        const res = await buyShares(marketId, side, amountKobo, buyQ.shares * SLIPPAGE);
        if (!res.ok) return setError(res.error);
        toast(`Bought ${formatShares(res.value.shares)} ${side} shares for ${formatNaira(res.value.amount_kobo)}`);
      } else if (mode === "sell" && sellQ) {
        const res = await sellShares(marketId, side, sellQ.shares, sellQ.netKobo * SLIPPAGE);
        if (!res.ok) return setError(res.error);
        toast(`Sold ${formatShares(res.value.shares)} ${side} shares for ${formatNaira(res.value.amount_kobo)}`);
      }
      setInput("");
    });
  };

  const sideBtn = (s: Outcome) => {
    const active = side === s;
    const activeCls = s === "YES" ? "bg-yes text-black" : "bg-no text-black";
    const idleCls = s === "YES" ? "bg-yes/10 text-yes hover:bg-yes/20" : "bg-no/10 text-no hover:bg-no/20";
    return (
      <button
        type="button"
        onClick={() => {
          setSide(s);
          setError(null);
          if (mode === "sell") setInput("");
        }}
        aria-pressed={active}
        className={`flex flex-col items-center rounded-xl py-2.5 font-semibold transition ${active ? activeCls : idleCls}`}
      >
        <span className="text-sm">{s}</span>
        <span className="text-xs tabular-nums opacity-80">{formatNaira(priceOf(pools, s) * SHARE_VALUE_KOBO)}</span>
      </button>
    );
  };

  if (!loggedIn) {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-center">
        <p className="font-semibold text-white">Ready to make your call?</p>
        <p className="text-sm text-muted">Create a free account, fund your wallet and trade in seconds.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/login?next=/markets/${marketId}`} className="rounded-xl border border-line py-2.5 text-sm font-semibold text-white hover:bg-card-2">
            Log in
          </Link>
          <Link href="/signup" className="rounded-xl bg-brand py-2.5 text-sm font-bold text-black hover:brightness-110">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 rounded-xl border border-line bg-bg p-1">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setInput("");
              setError(null);
            }}
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
          <label htmlFor="trade-amount">{mode === "buy" ? "Stake (₦)" : "Shares to sell"}</label>
          <span className="tabular-nums">
            {mode === "buy" ? (
              <>
                Balance: {formatNaira(balance)}{" "}
                <Link href="/wallet" className="font-semibold text-brand hover:underline">
                  Top up
                </Link>
              </>
            ) : (
              `Held: ${formatShares(held)} ${side}`
            )}
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
            disabled={closed || pending}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="w-full rounded-xl border border-line bg-bg px-3 py-3 pr-16 text-lg font-semibold tabular-nums text-white placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:opacity-50"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {mode === "buy" ? "₦" : "shares"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {mode === "buy"
            ? QUICK_NAIRA.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={closed || pending}
                  onClick={() => setInput(String(Math.min(q, Math.floor(balance / 100))))}
                  className="rounded-lg border border-line bg-bg py-1.5 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
                >
                  ₦{q.toLocaleString()}
                </button>
              ))
            : [0.25, 0.5, 0.75, 1].map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={closed || pending || held <= 0}
                  onClick={() => setInput(String(Math.floor(held * f * 100) / 100))}
                  className="rounded-lg border border-line bg-bg py-1.5 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
                >
                  {f === 1 ? "Max" : `${f * 100}%`}
                </button>
              ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-bg px-3 py-2">
        {mode === "buy" ? (
          <>
            <Row label="Avg price / share" value={formatNaira(buyQ?.avgPriceKobo ?? price * SHARE_VALUE_KOBO)} />
            <Row label="Est. shares" value={formatShares(buyQ?.shares ?? 0)} />
            <Row
              label={`Payout if ${side} wins`}
              value={formatNaira(buyQ?.payoutKobo ?? 0)}
              tone={side === "YES" ? "yes" : "no"}
            />
            <Row
              label="Potential profit"
              value={buyQ ? `${formatSignedNaira(buyQ.profitKobo)} (${formatSignedPct(buyQ.roi)})` : "-"}
              tone="muted"
            />
            <Row label={`Fee (${feeBps / 100}%)`} value={formatNaira(buyQ?.feeKobo ?? 0)} tone="muted" />
          </>
        ) : (
          <>
            <Row label="Avg sell price" value={formatNaira(sellQ?.avgPriceKobo ?? price * SHARE_VALUE_KOBO)} />
            <Row label="You receive" value={formatNaira(sellQ?.netKobo ?? 0)} />
            <Row
              label="Realized P&L"
              value={sellQ ? formatSignedNaira(sellQ.netKobo - sellCostShare) : "-"}
              tone={sellQ ? (sellQ.netKobo >= sellCostShare ? "yes" : "no") : "muted"}
            />
            <Row label={`Fee (${feeBps / 100}%)`} value={formatNaira(sellQ?.feeKobo ?? 0)} tone="muted" />
          </>
        )}
        {(buyQ || sellQ) && (
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
            <span>YES odds after trade</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              {formatPct(priceOf(pools, "YES"))}
              <ArrowRight className="size-3" />
              <span className="font-semibold text-white">{formatPct((buyQ ?? sellQ)?.probYesAfter ?? 0)}</span>
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
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted ${
          side === "YES" ? "bg-yes hover:brightness-110" : "bg-no hover:brightness-110"
        }`}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending
          ? "Placing trade..."
          : (blocker ??
            (value > 0
              ? `${mode === "buy" ? "Buy" : "Sell"} ${side} · ${formatNaira(mode === "buy" ? amountKobo : (sellQ?.netKobo ?? 0))}`
              : mode === "buy"
                ? "Enter a stake"
                : "Enter shares to sell"))}
      </button>
      <p className="text-center text-[11px] text-muted">
        Each winning share pays {formatNaira(SHARE_VALUE_KOBO)}. Prices move with every trade.
      </p>
    </div>
  );
}
