"use client";

import { AlertCircle, ArrowRight, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { placeBet } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { compactNaira, formatNaira, formatPct, formatSignedNaira } from "@/lib/format";
import { estimateBet } from "@/lib/pool";
import { useNow } from "@/lib/useNow";
import type { Outcome } from "@/lib/types";
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
}

const QUICK_NAIRA = [500, 1000, 2000, 5000] as const;

export function TradeBox(props: Props) {
  const { marketId, feeBps, minTradeKobo, balanceKobo } = props;
  const pot = { stake_yes_kobo: props.stakeYesKobo, stake_no_kobo: props.stakeNoKobo };
  const total = props.stakeYesKobo + props.stakeNoKobo;
  const { toast } = useUI();
  const now = useNow(props.serverNow, 15_000);
  const [side, setSide] = useState<Outcome>(props.initialSide);
  const [amount, setAmount] = useState(props.initialAmountNaira ? String(props.initialAmountNaira) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loggedIn = balanceKobo !== null;
  const balance = balanceKobo ?? 0;
  const closed = now >= new Date(props.closesAt).getTime();
  const naira = Number.parseFloat(amount);
  const stakeKobo = Number.isFinite(naira) && naira > 0 ? Math.round(naira * 100) : 0;
  const est = estimateBet(pot, side, stakeKobo, feeBps);
  const other: Outcome = side === "YES" ? "NO" : "YES";
  const otherPot = side === "YES" ? props.stakeNoKobo : props.stakeYesKobo;
  const yesShare = total > 0 ? props.stakeYesKobo / total : 0.5;

  let blocker: string | null = null;
  if (closed) blocker = "Betting closed";
  else if (stakeKobo > balance) blocker = "Not enough in your wallet";
  else if (stakeKobo > 0 && stakeKobo < minTradeKobo) blocker = `Minimum bet is ${formatNaira(minTradeKobo)}`;

  const submit = () => {
    if (!est || blocker || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await placeBet(marketId, side, stakeKobo);
      if (!res.ok) return setError(res.error);
      toast(`Bet placed: ${formatNaira(res.value.amount_kobo)} on ${side}. Good luck!`);
      setAmount("");
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
      <div className="rounded-xl bg-bg px-3 py-2 text-xs">
        <div className="flex justify-between text-muted">
          <span>In the pot</span>
          <span className="font-semibold tabular-nums text-white">{formatNaira(total)}</span>
        </div>
        <div className="mt-1 flex justify-between tabular-nums">
          <span className="text-yes">YES {compactNaira(props.stakeYesKobo)}</span>
          <span className="text-no">NO {compactNaira(props.stakeNoKobo)}</span>
        </div>
      </div>

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
              <span className="text-xs tabular-nums opacity-80">{formatPct(s === "YES" ? yesShare : 1 - yesShare)} of the pot</span>
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
      </div>

      <div className="rounded-xl border border-line bg-bg p-3">
        {est ? (
          <>
            <p className="text-xs text-muted">If {side} wins and betting closed now, you&apos;d get</p>
            <p className={`text-2xl font-extrabold tabular-nums ${side === "YES" ? "text-yes" : "text-no"}`}>
              {formatNaira(est.payoutKobo)}
            </p>
            <p className="text-xs text-muted">
              {otherPot > 0 ? (
                <>
                  That&apos;s <span className="font-semibold text-white">{formatSignedNaira(est.profitKobo)}</span> on{" "}
                  {formatNaira(stakeKobo)}. If {other} wins, you lose your stake.
                </>
              ) : (
                <>Nobody has bet {other} yet, so right now you&apos;d just get your stake back. Share it so others take the other side.</>
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
            Winners split the {other} pot in proportion to their bets. Enter an amount to see your estimated payout.
          </p>
        )}
      </div>

      <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Pool betting: the final payout depends on all bets placed before closing. UniPred keeps {feeBps / 100}% of the
        winnings. Bets can&apos;t be cashed out early.
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
        {pending ? "Placing bet..." : (blocker ?? (stakeKobo > 0 ? `Bet ${formatNaira(stakeKobo)} on ${side}` : "Enter an amount"))}
      </button>

      <div className="flex justify-center">
        <ShareButton
          variant="subtle"
          label={stakeKobo > 0 ? `Share this bet (${formatNaira(stakeKobo)} on ${side})` : `Share a ${side} bet link`}
          path={`/markets/${marketId}?side=${side}${stakeKobo > 0 ? `&amount=${Math.round(stakeKobo / 100)}` : ""}`}
          text={`I'm backing ${side} on "${props.question}"${stakeKobo > 0 ? ` with ${formatNaira(stakeKobo)}` : ""}. Think I'm wrong? Take the other side on UniPred:`}
          refUsername={props.refUsername}
        />
      </div>
    </div>
  );
}
