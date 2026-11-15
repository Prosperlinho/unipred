"use client";

import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  approveMarket,
  approveWithdrawal,
  cancelMarket,
  rejectMarket,
  rejectWithdrawal,
  resolveMarket,
} from "@/app/actions/admin";
import { CategoryBadge } from "@/components/CategoryBadge";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { marketProbYes } from "@/lib/pool";
import { compactNaira, formatDate, formatNaira, formatPct } from "@/lib/format";
import type { ActionResult, Market, Withdrawal } from "@/lib/types";

function useRunner() {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, success: (v: T) => string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast(res.error, "error");
      else toast(success(res.value));
    });
  return { pending, run };
}

export function PendingMarketCard({ market, proposer, school }: { market: Market; proposer: string; school: string }) {
  const { pending, run } = useRunner();
  const [note, setNote] = useState("");

  return (
    <article className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <CategoryBadge category={market.category} />
        <span className="font-semibold text-brand-gold">{school}</span>
        <span className="text-muted">by @{proposer}</span>
      </div>
      <p className="font-semibold text-white">{market.question}</p>
      <p className="text-sm text-white/80">{market.criteria}</p>
      <p className="text-xs text-muted">
        Source: {market.source} · Closes {formatDate(market.closes_at)}
      </p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (shown to the proposer if rejected)"
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveMarket(market.id), () => "Market is live.")}
          className="flex items-center justify-center gap-1 rounded-xl bg-yes py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rejectMarket(market.id, note), () => "Proposal rejected.")}
          className="flex items-center justify-center gap-1 rounded-xl border border-no/50 py-2 text-sm font-bold text-no disabled:opacity-50"
        >
          <X className="size-4" /> Reject
        </button>
      </div>
    </article>
  );
}

export function OpenMarketRow({ market, school, now }: { market: Market; school: string; now: number }) {
  const { pending, run } = useRunner();
  const [confirm, setConfirm] = useState<"YES" | "NO" | "CANCEL" | null>(null);
  const [note, setNote] = useState("");
  const closed = new Date(market.closes_at).getTime() <= now;

  const go = (choice: "YES" | "NO" | "CANCEL") => {
    if (confirm !== choice) return setConfirm(choice);
    setConfirm(null);
    if (choice === "CANCEL") run(() => cancelMarket(market.id, note), (m) => m);
    else run(() => resolveMarket(market.id, choice), (m) => m);
  };

  return (
    <article className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-brand-gold">{school}</span>
        <span className={closed ? "font-semibold text-amber-300" : "text-muted"}>
          {closed ? "Closed, needs result" : `Closes ${formatDate(market.closes_at)}`}
        </span>
      </div>
      <Link href={`/markets/${market.id}`} className="block font-semibold text-white hover:underline">
        {market.question}
      </Link>
      <p className="text-xs text-muted">
        YES {formatPct(marketProbYes(market))} · {compactNaira(Number(market.stake_yes_kobo) + Number(market.stake_no_kobo))} in pot · {market.traders} traders
      </p>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cancellation reason (optional)" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        {(["YES", "NO", "CANCEL"] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={pending}
            onClick={() => go(c)}
            className={`rounded-xl py-2 text-xs font-bold transition disabled:opacity-50 ${
              confirm === c
                ? c === "YES"
                  ? "bg-yes text-black"
                  : c === "NO"
                    ? "bg-no text-black"
                    : "bg-white text-black"
                : c === "YES"
                  ? "bg-yes/15 text-yes"
                  : c === "NO"
                    ? "bg-no/15 text-no"
                    : "border border-line text-muted"
            }`}
          >
            {confirm === c ? "Tap to confirm" : c === "CANCEL" ? "Cancel & refund" : `Resolve ${c}`}
          </button>
        ))}
      </div>
    </article>
  );
}

export function WithdrawalRow({ w, username }: { w: Withdrawal; username: string }) {
  const { pending, run } = useRunner();
  const [note, setNote] = useState("");
  return (
    <article className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold tabular-nums text-white">{formatNaira(w.amount_kobo)}</span>
        <span className="text-xs capitalize text-muted">{w.status}</span>
      </div>
      <p className="text-sm text-white/80">
        @{username} → {w.account_name}, {w.bank_name} ••{w.account_number.slice(-4)}
      </p>
      <p className="text-xs text-muted">Requested {formatDate(w.created_at)}</p>
      {w.status === "pending" && (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rejection reason" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveWithdrawal(w.id), (m) => m)}
              className="flex items-center justify-center gap-1 rounded-xl bg-yes py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Pay out
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => rejectWithdrawal(w.id, note), () => "Withdrawal rejected and refunded.")}
              className="flex items-center justify-center gap-1 rounded-xl border border-no/50 py-2 text-sm font-bold text-no disabled:opacity-50"
            >
              <X className="size-4" /> Reject
            </button>
          </div>
        </>
      )}
    </article>
  );
}
