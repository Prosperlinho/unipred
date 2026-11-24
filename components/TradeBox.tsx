"use client";

import { AlertCircle, AlertTriangle, ArrowRight, Info, Loader2, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { placeBet } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { compactNaira, formatNaira, formatPct, formatSignedNaira } from "@/lib/format";
import { AMM_TRADE_FEE_BPS, cashOutValue, estimateBet } from "@/lib/pool";
import { quoteBuy } from "@/lib/amm";
import { useNow } from "@/lib/useNow";
import type { Outcome } from "@/lib/types";
import { CashOutPanel } from "./CashOutPanel";
import { LiveBadge } from "./LiveRefresh";
import { ShareButton } from "./ShareButton";

interface Props {
  marketId: string;
  question: string;
  stakeYesKobo: number;
  stakeNoKobo: number;
  closesAt: string;
  feeBps: number;
  minTradeKobo: number;
  balanceKobo: number | null;
  initialSide: Outcome;
  initialAmountNaira: number | null;
  refUsername: string | null;
  serverNow: number;
  /** Kobo the user has in each pot (for cash-out). */
  myStakes: Partial<Record<Outcome, number>>;
  exitFeeBps: number;
  /** "amm" = house liquidity: odds move with each trade and cash-out is at the live price. */
  engine?: "pool" | "amm";
  poolYes?: number;
  poolNo?: number;
  /** Shares held on each side (house-liquidity markets). */
  myShares?: Partial<Record<Outcome, number>>;
  /** When cash-out opens (ms): halfway between going live and closing. */
  cashOutOpensAt?: number;
}

const QUICK_NAIRA = [500, 1000, 2000, 5000] as const;

export function TradeBox(props: Props) {
  const { marketId, feeBps, minTradeKobo, balanceKobo } = props;
  const amm = props.engine === "amm";
  const pot = {
    stake_yes_kobo: props.stakeYesKobo,
    stake_no_kobo: props.stakeNoKobo,
    engine: props.engine ?? "pool",
    pool_yes: props.poolYes ?? 0,
    pool_no: props.poolNo ?? 0,
  };
  const total = props.stakeYesKobo + props.stakeNoKobo;
  const { toast } = useUI();
  const now = useNow(props.serverNow, 15_000);
  const [side, setSide] = useState<Outcome>(props.initialSide);
  const [amount, setAmount] = useState(props.initialAmountNaira ? String(props.initialAmountNaira) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"bet" | "cashout">("bet");
  const hasStake = (props.myStakes.YES ?? 0) > 0 || (props.myStakes.NO ?? 0) > 0;
  const tab = hasStake ? mode : "bet";

  const loggedIn = balanceKobo !== null;
  const balance = balanceKobo ?? 0;
  const closed = now >= new Date(props.closesAt).getTime();
  const naira = Number.parseFloat(amount);
  const stakeKobo = Number.isFinite(naira) && naira > 0 ? Math.round(naira * 100) : 0;
  const est = estimateBet(pot, side, stakeKobo, feeBps);
  // Polymarket-style quote for house-liquidity markets: shares, average price, and what they'd sell for right away.
  const ammQuote = amm && stakeKobo > 0 ? quoteBuy({ pool_yes: pot.pool_yes, pool_no: pot.pool_no }, side, stakeKobo, AMM_TRADE_FEE_BPS) : null;
  const sellNowKobo = (() => {
    if (!ammQuote) return 0;
    const sets = (stakeKobo - ammQuote.feeKobo) / 10_000;
    const k = pot.pool_yes * pot.pool_no;
    const after =
      side === "YES"
        ? { pool_no: pot.pool_no + sets, pool_yes: k / (pot.pool_no + sets) }
        : { pool_yes: pot.pool_yes + sets, pool_no: k / (pot.pool_yes + sets) };
    return cashOutValue(after, side, ammQuote.shares);
  })();
  const other: Outcome = side === "YES" ? "NO" : "YES";
  // House liquidity is always on the other side, so a winning trade always profits.
  const otherPot = amm ? 1 : side === "YES" ? props.stakeNoKobo : props.stakeYesKobo;
  const yesShare = amm
    ? (props.poolNo ?? 0) / Math.max(1e-9, (props.poolYes ?? 0) + (props.poolNo ?? 0))
    : total > 0
      ? props.stakeYesKobo / total
      : 0.5;

  let blocker: string | null = null;
  if (closed) blocker = "Trading closed";
  else if (stakeKobo > balance) blocker = "Not enough in your wallet";
  else if (stakeKobo > 0 && stakeKobo < minTradeKobo) blocker = `Minimum trade is ${formatNaira(minTradeKobo)}`;

  const submit = () => {
    if (!est || blocker || pending) return;
    setError(null);
    setConfirming(true);
  };

  const confirmBet = () => {
    if (!est || blocker || pending) return;
    setConfirming(false);
    startTransition(async () => {
      const res = await placeBet(marketId, side, stakeKobo);
      if (!res.ok) return setError(res.error);
      toast(`Trade placed: ${formatNaira(res.value.amount_kobo)} on ${side}. Good luck!`);
      setAmount("");
    });
  };

  if (!loggedIn) {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-center">
        <p className="font-semibold text-white">Ready to make your call?</p>
        <p className="text-sm text-muted">Create a free account, fund your wallet and trade in seconds.</p>
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
      <div className="rounded-xl bg-bg px-3 py-2 text-xs">
        <div className="flex items-center justify-between text-muted">
          <span>
            {amm ? (
              <>Prices move as people trade</>
            ) : (
              <>
                In the pot <span className="font-semibold tabular-nums text-white">{formatNaira(total)}</span>
              </>
            )}
          </span>
          <LiveBadge intervalMs={30_000} />
        </div>
        {!amm && (
          <div className="mt-1 flex justify-between tabular-nums">
            <span className="text-yes">YES {compactNaira(props.stakeYesKobo)}</span>
            <span className="text-no">NO {compactNaira(props.stakeNoKobo)}</span>
          </div>
        )}
      </div>

      {hasStake && (
        <div className="grid grid-cols-2 rounded-xl border border-line bg-bg p-1">
          {(
            [
              ["bet", "Trade"],
              ["cashout", "Cash out"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={tab === m}
              className={`rounded-lg py-2 text-sm font-semibold transition ${tab === m ? "bg-card-2 text-white" : "text-muted hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "cashout" ? (
        <CashOutPanel
          marketId={marketId}
          question={props.question}
          stakes={props.myStakes}
          exitFeeBps={props.exitFeeBps}
          amm={amm ? { poolYes: props.poolYes ?? 0, poolNo: props.poolNo ?? 0, shares: props.myShares ?? {} } : null}
          opensAt={props.cashOutOpensAt && now < props.cashOutOpensAt ? props.cashOutOpensAt : null}
          closed={closed}
        />
      ) : (
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
              <span className="text-base">
                {s}
                {amm && <span className="ml-1.5 tabular-nums">₦{Math.round((s === "YES" ? yesShare : 1 - yesShare) * 100)}</span>}
              </span>
              <span className="text-xs tabular-nums opacity-80">{formatPct(s === "YES" ? yesShare : 1 - yesShare)} {amm ? "chance" : "of the pot"}</span>
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="trade-amount" className="mb-1.5 block text-xs font-semibold text-white">
          How much do you want to trade?
        </label>
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
              if (e.key === "Enter") submit();
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
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <Wallet className="size-4 shrink-0 text-amber-300" />
            <span className="shrink-0">Wallet</span>
            <span className="truncate font-bold tabular-nums text-white">{formatNaira(balance)}</span>
          </span>
          <Link
            href="/wallet"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand transition hover:bg-brand/25"
          >
            <Plus className="size-3.5" strokeWidth={3} /> Top up
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-bg p-3">
        {amm && ammQuote ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-muted">You get</p>
                <p className="text-lg font-extrabold tabular-nums text-white">{ammQuote.shares.toFixed(1)} shares</p>
                <p className="text-[11px] tabular-nums text-muted">avg ₦{(ammQuote.avgPriceKobo / 100).toFixed(2)} each</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted">If {side} wins</p>
                <p className={`text-lg font-extrabold tabular-nums ${side === "YES" ? "text-yes" : "text-no"}`}>{formatNaira(ammQuote.payoutKobo)}</p>
                <p className="text-[11px] tabular-nums text-muted">₦100 per share · {formatSignedNaira(ammQuote.profitKobo)}</p>
              </div>
            </div>
            <p className="mt-2 rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-muted">
              Worth about <b className="text-white">{formatNaira(sellNowKobo)}</b> if you sold straight away (fees + price move), so
              you only profit if the odds move your way or {side} wins.
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
              <span>{side} price</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                ₦{Math.round((side === "YES" ? yesShare : 1 - yesShare) * 100)}
                <ArrowRight className="size-3" />
                <span className="font-semibold text-white">
                  ₦{Math.round((side === "YES" ? ammQuote.probYesAfter : 1 - ammQuote.probYesAfter) * 100)}
                </span>
              </span>
            </div>
          </>
        ) : est ? (
          <>
            <p className="text-xs text-muted">If {side} wins and trading closed now, you&apos;d get</p>
            <p className={`text-2xl font-extrabold tabular-nums ${side === "YES" ? "text-yes" : "text-no"}`}>
              {formatNaira(est.payoutKobo)}
            </p>
            <p className="text-xs text-muted">
              {otherPot > 0 ? (
                <>
                  <span className="font-semibold text-white">{formatSignedNaira(est.profitKobo)}</span> profit. Lose your stake if{" "}
                  {other} wins.
                </>
              ) : (
                <>No one is on {other} yet, so you&apos;d only get your stake back.</>
              )}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
              <span>YES share of the pot</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                {formatPct(yesShare)}
                <ArrowRight className="size-3" />
                <span className="font-semibold text-white">{formatPct(est.probYesAfter)}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            Enter an amount to see your payout.
          </p>
        )}
      </div>

      <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {amm
          ? "Odds move with every trade · each winning share pays ₦100 · cash out from halfway, at the live price."
          : `Estimate only · ${feeBps / 100}% fee on winnings · ${props.exitFeeBps / 100}% fee to cash out early.`}
      </p>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-no" role="alert">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!est || !!blocker || pending}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted ${
          side === "YES" ? "bg-yes hover:brightness-110" : "bg-no hover:brightness-110"
        }`}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Placing trade..." : (blocker ?? (stakeKobo > 0 ? `Trade ${formatNaira(stakeKobo)} on ${side}` : "Enter an amount"))}
      </button>

      {confirming && est && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-bet-title">
          <div className="w-full animate-sheet-up rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-2xl">
            <p id="confirm-bet-title" className="flex items-center gap-2 font-bold text-white">
              <AlertTriangle className="size-5 text-amber-300" /> Confirm your trade
            </p>
            <p className="mt-1 text-sm text-muted">{props.question}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">You stake</p>
                <p className="text-lg font-extrabold tabular-nums text-white">{formatNaira(stakeKobo)}</p>
                <p className={`text-xs font-bold ${side === "YES" ? "text-yes" : "text-no"}`}>on {side}</p>
              </div>
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">If {side} wins (est.)</p>
                <p className={`text-lg font-extrabold tabular-nums ${side === "YES" ? "text-yes" : "text-no"}`}>
                  {formatNaira(est.payoutKobo)}
                </p>
                <p className="text-xs text-muted">may change until closing</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
              <li>• You lose {formatNaira(stakeKobo)} if {other} wins.</li>
              <li>
                • {amm ? "Odds can move before your trade goes through. Cash-out opens halfway to closing, at the live price." : `Payout is an estimate. Cash-out opens halfway to closing and costs ${props.exitFeeBps / 100}%.`}
              </li>
              <li>• 18+. Only stake what you can afford to lose.</li>
            </ul>
            <p className="mt-2 text-[11px] text-muted">
              By confirming you agree to the{" "}
              <Link href="/rules" target="_blank" className="text-brand underline">
                House Rules
              </Link>
              .
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-line py-3 text-sm font-semibold text-white hover:bg-card-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBet}
                className={`rounded-xl py-3 text-sm font-bold text-black transition hover:brightness-110 ${
                  side === "YES" ? "bg-yes" : "bg-no"
                }`}
              >
                Confirm {formatNaira(stakeKobo)} on {side}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <ShareButton
          variant="subtle"
          label={stakeKobo > 0 ? `Share this trade (${formatNaira(stakeKobo)} on ${side})` : `Share a ${side} trade link`}
          path={`/markets/${marketId}?side=${side}${stakeKobo > 0 ? `&amount=${Math.round(stakeKobo / 100)}` : ""}`}
          text={`I'm backing ${side} on "${props.question}"${stakeKobo > 0 ? ` with ${formatNaira(stakeKobo)}` : ""}. Think I'm wrong? Take the other side on UniPred:`}
          refUsername={props.refUsername}
        />
      </div>
      </>
      )}
    </div>
  );
}
