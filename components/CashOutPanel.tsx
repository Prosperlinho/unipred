"use client";

import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { cashOutBet } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";
import { cashOutValue } from "@/lib/pool";
import type { Outcome } from "@/lib/types";

interface Props {
  marketId: string;
  question: string;
  /** Kobo the user currently has in each pot. */
  stakes: Partial<Record<Outcome, number>>;
  exitFeeBps: number;
  closed: boolean;
  /** House-liquidity markets: cash out at the live price instead of the flat exit fee. */
  amm?: { poolYes: number; poolNo: number; shares: Partial<Record<Outcome, number>> } | null;
}

const PCTS = [25, 50, 75, 100] as const;

/** Early exit: take part or all of a bet back out of the pot, minus the exit fee. */
export function CashOutPanel({ marketId, question, stakes, exitFeeBps, closed, amm }: Props) {
  const { toast } = useUI();
  const held = (["YES", "NO"] as const).filter((o) => (stakes[o] ?? 0) > 0);
  const [choice, setChoice] = useState<Outcome>(held[0] ?? "YES");
  const side: Outcome = held.includes(choice) ? choice : (held[0] ?? "YES");
  const [pct, setPct] = useState<number>(100);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stake = stakes[side] ?? 0;
  const amount = pct === 100 ? stake : Math.floor((stake * pct) / 100);
  // Pot markets: flat exit fee. House-liquidity markets: sell the shares at today's price (profit or loss).
  const liveBack = amm
    ? cashOutValue({ pool_yes: amm.poolYes, pool_no: amm.poolNo }, side, ((amm.shares[side] ?? 0) * pct) / 100)
    : 0;
  const fee = amm ? 0 : Math.floor((amount * exitFeeBps) / 10_000);
  const back = amm ? liveBack : amount - fee;
  const feePct = exitFeeBps / 100;
  // House-liquidity markets: compare today's value with what that part of the bet cost.
  const pnl = back - amount;

  const confirm = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await cashOutBet(marketId, side, pct);
      if (!res.ok) return setError(res.error);
      toast(`Cashed out ${formatNaira(res.value.returned_kobo)} to your wallet.`);
      setPct(100);
    });
  };

  if (held.length === 0) {
    return <p className="rounded-xl bg-bg p-3 text-sm text-muted">You don&apos;t have a bet on this market to cash out.</p>;
  }

  return (
    <div className="space-y-4">
      {held.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {held.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setChoice(o)}
              aria-pressed={side === o}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                side === o ? (o === "YES" ? "bg-yes text-black" : "bg-no text-black") : "border border-line text-muted hover:text-white"
              }`}
            >
              My {o} bet · {formatNaira(stakes[o] ?? 0)}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-bg px-3 py-2 text-sm">
        You have <span className="font-bold text-white">{formatNaira(stake)}</span> on{" "}
        <span className={`font-bold ${side === "YES" ? "text-yes" : "text-no"}`}>{side}</span>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-white">How much do you want to take out?</p>
        <div className="grid grid-cols-4 gap-2">
          {PCTS.map((p) => (
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

      <div className="rounded-xl border border-line bg-bg p-3">
        <p className="text-xs text-muted">You get back now</p>
        <p className="text-2xl font-extrabold tabular-nums text-white">{formatNaira(back)}</p>
        {amm ? (
          <p className="text-xs text-muted">
            At today&apos;s odds. You paid {formatNaira(amount)} for this part:{" "}
            <span className={`font-bold ${pnl >= 0 ? "text-yes" : "text-no"}`}>
              {pnl >= 0 ? "+" : "-"}
              {formatNaira(Math.abs(pnl))} {pnl >= 0 ? "profit" : "loss"}
            </span>
            .{pct < 100 && ` The rest stays on ${side}.`}
          </p>
        ) : (
          <p className="text-xs text-muted">
            {formatNaira(amount)} out of the pot, minus the {feePct}% exit fee ({formatNaira(fee)}).
            {pct < 100 && ` ${formatNaira(stake - amount)} stays on ${side}.`}
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
        onClick={() => setConfirming(true)}
        disabled={closed || pending || back <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-base font-bold text-black transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Cashing out..." : closed ? "Betting closed" : `Cash out ${formatNaira(back)}`}
      </button>
      <p className="text-center text-[11px] text-muted">
        {amm
          ? "The cash-out value moves with the odds. If you think you're right, holding until the result pays ₦100 per share."
          : "Cashing out early always returns less than you put in. If you think you're right, holding until the result can pay more."}
      </p>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-cashout-title">
          <div className="w-full animate-sheet-up rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-2xl">
            <p id="confirm-cashout-title" className="flex items-center gap-2 font-bold text-white">
              <AlertTriangle className="size-5 text-amber-300" /> Confirm cash-out
            </p>
            <p className="mt-1 text-sm text-muted">{question}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Taking out</p>
                <p className="text-lg font-extrabold tabular-nums text-white">{formatNaira(amount)}</p>
                <p className={`text-xs font-bold ${side === "YES" ? "text-yes" : "text-no"}`}>from {side}</p>
              </div>
              <div className="rounded-xl bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">You receive</p>
                <p className="text-lg font-extrabold tabular-nums text-white">{formatNaira(back)}</p>
                <p className="text-xs text-muted">{amm ? "at today's odds" : `after ${formatNaira(fee)} fee`}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
              <li>• This can&apos;t be undone. To get back in, you&apos;d place a new bet at the new odds.</li>
              <li>• {amm ? "The amount is set by the odds when it goes through; it can move a little." : `UniPred keeps a ${feePct}% exit fee on the amount you take out.`}</li>
              {pct < 100 && <li>• {formatNaira(stake - amount)} stays on {side} and is settled with the market.</li>}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-line py-3 text-sm font-semibold text-white hover:bg-card-2"
              >
                Keep my bet
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-xl bg-white py-3 text-sm font-bold text-black transition hover:brightness-95"
              >
                Cash out {formatNaira(back)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
