"use client";

import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { buyShares, sellShares } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { SHARE_VALUE_KOBO, priceOf, quoteBuy, quoteSell } from "@/lib/amm";
import { compactNaira, formatNaira, formatPct, formatSignedNaira } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Outcome, Pools } from "@/lib/types";
import { ShareButton } from "./ShareButton";

export interface Holding {
  shares: number;
  cost_kobo: number;
}

interface Props {
  marketId: string;
  question: string;
  pools: Pools;
  closesAt: string;
  feeBps: number;
  minTradeKobo: number;
  balanceKobo: number | null;
  holdings: Partial<Record<Outcome, Holding>>;
  initialSide: Outcome;
  initialAmountNaira: number | null;
  refUsername: string | null;
  serverNow: number;
}

type Mode = "bet" | "cashout";
const QUICK_NAIRA = [500, 1000, 2000, 5000] as const;
const CASHOUT_PCTS = [25, 50, 75, 100] as const;
const SLIPPAGE = 0.98; // reject if the price moves more than 2% before execution

export function TradeBox(props: Props) {
  const { marketId, pools, feeBps, minTradeKobo, balanceKobo, holdings } = props;
  const { toast } = useUI();
  const now = useNow(props.serverNow, 15_000);
  const heldSides = (["YES", "NO"] as const).filter((o) => (holdings[o]?.shares ?? 0) > 0);

  const [modeChoice, setMode] = useState<Mode>("bet");
  const [side, setSide] = useState<Outcome>(props.initialSide);
  const [amount, setAmount] = useState(props.initialAmountNaira ? String(props.initialAmountNaira) : "");
  const [cashChoice, setCashSide] = useState<Outcome>(heldSides[0] ?? "YES");
  const [pct, setPct] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // If the user cashes out everything, fall back to the Bet tab / a side they still hold.
  const mode: Mode = heldSides.length > 0 ? modeChoice : "bet";
  const cashSide: Outcome = heldSides.includes(cashChoice) ? cashChoice : (heldSides[0] ?? "YES");

  const loggedIn = balanceKobo !== null;
  const balance = balanceKobo ?? 0;
  const closed = now >= new Date(props.closesAt).getTime();

  // ---- Bet ----
  const naira = Number.parseFloat(amount);
  const stakeKobo = Number.isFinite(naira) && naira > 0 ? Math.round(naira * 100) : 0;
  const buyQ = quoteBuy(pools, side, stakeKobo, feeBps);
  let betBlocker: string | null = null;
  if (closed) betBlocker = "Betting closed";
  else if (stakeKobo > balance) betBlocker = "Not enough in your wallet";
  else if (stakeKobo > 0 && stakeKobo < minTradeKobo) betBlocker = `Minimum bet is ${formatNaira(minTradeKobo)}`;

  // ---- Cash out ----
  const holding = holdings[cashSide];
  const fullValue = holding ? quoteSell(pools, cashSide, holding.shares, feeBps) : null;
  const sellShares_ = holding ? (holding.shares * pct) / 100 : 0;
  const sellQ = holding ? quoteSell(pools, cashSide, sellShares_, feeBps) : null;
  const costPart = holding ? Math.round((holding.cost_kobo * pct) / 100) : 0;

  const submitBet = () => {
    if (!buyQ || betBlocker || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await buyShares(marketId, side, stakeKobo, buyQ.shares * SLIPPAGE);
      if (!res.ok) return setError(res.error);
      toast(
        `Bet placed: ${formatNaira(res.value.amount_kobo)} on ${side}. You win ${formatNaira(
          Math.floor(res.value.shares * SHARE_VALUE_KOBO),
        )} if ${side} is right.`,
      );
      setAmount("");
    });
  };

  const submitCashout = () => {
    if (!sellQ || !holding || closed || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await sellShares(marketId, cashSide, sellQ.shares, sellQ.netKobo * SLIPPAGE);
      if (!res.ok) return setError(res.error);
      toast(`Cashed out ${formatNaira(res.value.amount_kobo)} to your wallet.`);
      setPct(100);
    });
  };

  if (!loggedIn) {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-center">
        <p className="font-semibold text-white">Ready to make your call?</p>
        <p className="text-sm text-muted">Create a free account, fund your wallet and bet in seconds.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/markets/${marketId}`)}`}
            className="rounded-xl border border-line py-2.5 text-sm font-semibold text-white hover:bg-card-2"
          >
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
      {heldSides.length > 0 && (
        <div className="grid grid-cols-2 rounded-xl border border-line bg-bg p-1">
          {(
            [
              ["bet", "Bet"],
              ["cashout", "Cash out"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              aria-pressed={mode === m}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? "bg-card-2 text-white" : "text-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "bet" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((s) => {
              const active = side === s;
              const activeCls = s === "YES" ? "bg-yes text-black" : "bg-no text-black";
              const idleCls = s === "YES" ? "bg-yes/10 text-yes hover:bg-yes/20" : "bg-no/10 text-no hover:bg-no/20";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSide(s);
                    setError(null);
                  }}
                  aria-pressed={active}
                  className={`flex flex-col items-center rounded-xl py-2.5 font-semibold transition ${active ? activeCls : idleCls}`}
                >
                  <span className="text-base">{s}</span>
                  <span className="text-xs tabular-nums opacity-80">{formatPct(priceOf(pools, s))} chance</span>
                </button>
              );
            })}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
              <label htmlFor="trade-amount">How much do you want to bet?</label>
              <span className="tabular-nums">
                Wallet: {formatNaira(balance)}{" "}
                <Link href="/wallet" className="font-semibold text-brand hover:underline">
                  Top up
                </Link>
              </span>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">₦</span>
              <input
                id="trade-amount"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                value={amount}
                disabled={closed || pending}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitBet();
                }}
                className="w-full rounded-xl border border-line bg-bg py-3 pl-8 pr-3 text-lg font-semibold tabular-nums text-white placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {QUICK_NAIRA.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={closed || pending}
                  onClick={() => setAmount(String(q))}
                  className="rounded-lg border border-line bg-bg py-1.5 text-xs font-semibold text-white transition hover:bg-card-2 disabled:opacity-40"
                >
                  ₦{q.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-bg p-3">
            {buyQ ? (
              <>
                <p className="text-xs text-muted">If {side} is right, you get</p>
                <p className={`text-2xl font-extrabold tabular-nums ${side === "YES" ? "text-yes" : "text-no"}`}>
                  {formatNaira(buyQ.payoutKobo)}
                </p>
                <p className="text-xs text-muted">
                  That&apos;s <span className="font-semibold text-white">{formatSignedNaira(buyQ.profitKobo)}</span> profit
                  on {formatNaira(stakeKobo)}. If {side === "YES" ? "NO" : "YES"} wins, you lose your stake.
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
                  <span>Odds after your bet</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    YES {formatPct(priceOf(pools, "YES"))}
                    <ArrowRight className="size-3" />
                    <span className="font-semibold text-white">{formatPct(buyQ.probYesAfter)}</span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">Includes a {feeBps / 100}% fee ({formatNaira(buyQ.feeKobo)}).</p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Every <span className="font-semibold text-white">₦1,000</span> on {side} pays about{" "}
                <span className={`font-semibold ${side === "YES" ? "text-yes" : "text-no"}`}>
                  {compactNaira(quoteBuy(pools, side, 100_000, feeBps)?.payoutKobo ?? 0)}
                </span>{" "}
                if {side} is right.
              </p>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-no" role="alert">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </p>
          )}

          <button
            type="button"
            onClick={submitBet}
            disabled={!buyQ || !!betBlocker || pending}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted ${
              side === "YES" ? "bg-yes hover:brightness-110" : "bg-no hover:brightness-110"
            }`}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Placing bet..." : (betBlocker ?? (stakeKobo > 0 ? `Bet ${formatNaira(stakeKobo)} on ${side}` : "Enter an amount"))}
          </button>

          <div className="flex justify-center">
            <ShareButton
              variant="subtle"
              label={stakeKobo > 0 ? `Share this bet (${formatNaira(stakeKobo)} on ${side})` : `Share a ${side} bet link`}
              path={`/markets/${marketId}?side=${side}${stakeKobo > 0 ? `&amount=${Math.round(stakeKobo / 100)}` : ""}`}
              text={`I'm backing ${side} on "${props.question}"${stakeKobo > 0 ? ` with ${formatNaira(stakeKobo)}` : ""}. Make your call on UniPred:`}
              refUsername={props.refUsername}
            />
          </div>
        </>
      ) : (
        <>
          {heldSides.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {heldSides.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCashSide(s)}
                  aria-pressed={cashSide === s}
                  className={`rounded-xl py-2 text-sm font-semibold transition ${
                    cashSide === s
                      ? s === "YES"
                        ? "bg-yes text-black"
                        : "bg-no text-black"
                      : "border border-line text-muted hover:text-white"
                  }`}
                >
                  My {s} bet
                </button>
              ))}
            </div>
          )}

          {holding && fullValue && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Staked</p>
                <p className="text-sm font-bold tabular-nums text-white">{formatNaira(holding.cost_kobo)}</p>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Worth now</p>
                <p className={`text-sm font-bold tabular-nums ${fullValue.netKobo >= holding.cost_kobo ? "text-yes" : "text-no"}`}>
                  {formatNaira(fullValue.netKobo)}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">If {cashSide} wins</p>
                <p className="text-sm font-bold tabular-nums text-white">
                  {formatNaira(Math.floor(holding.shares * SHARE_VALUE_KOBO))}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-muted">How much do you want to cash out?</p>
            <div className="grid grid-cols-4 gap-2">
              {CASHOUT_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={closed || pending}
                  onClick={() => setPct(p)}
                  aria-pressed={pct === p}
                  className={`rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40 ${
                    pct === p ? "bg-white text-black" : "border border-line bg-bg text-white hover:bg-card-2"
                  }`}
                >
                  {p === 100 ? "All" : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {sellQ && (
            <div className="rounded-xl border border-line bg-bg p-3">
              <p className="text-xs text-muted">You get now</p>
              <p className="text-2xl font-extrabold tabular-nums text-white">{formatNaira(sellQ.netKobo)}</p>
              <p className="text-xs text-muted">
                {sellQ.netKobo >= costPart ? "Profit" : "Loss"} on this part:{" "}
                <span className={`font-semibold ${sellQ.netKobo >= costPart ? "text-yes" : "text-no"}`}>
                  {formatSignedNaira(sellQ.netKobo - costPart)}
                </span>{" "}
                · includes a {feeBps / 100}% fee
              </p>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-no" role="alert">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </p>
          )}

          <button
            type="button"
            onClick={submitCashout}
            disabled={!sellQ || closed || pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-base font-bold text-black transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Cashing out..." : closed ? "Betting closed" : sellQ ? `Cash out ${formatNaira(sellQ.netKobo)}` : "Nothing to cash out"}
          </button>
        </>
      )}
    </div>
  );
}
