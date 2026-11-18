"use client";

import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  approveMarket,
  approveWithdrawal,
  cancelMarket,
  featureMarket,
  rejectMarket,
  rejectWithdrawal,
  resolveMarket,
  setAccountStatus,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          YES {formatPct(marketProbYes(market))} · {compactNaira(Number(market.stake_yes_kobo) + Number(market.stake_no_kobo))} in pot · {market.traders} traders
        </p>
        {!closed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => featureMarket(market.featured_at ? null : market.id), () => (market.featured_at ? "Unpinned." : "Pinned as Market of the day 🔥"))}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
              market.featured_at ? "bg-amber-400 text-black" : "border border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
            }`}
          >
            {market.featured_at ? "🔥 Market of the day" : "Make market of the day"}
          </button>
        )}
      </div>
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

export interface ReviewAccount {
  id: string;
  username: string;
  full_name: string;
  is_banned: boolean;
  ban_reason: string | null;
  flagged_reason: string | null;
  balance_kobo: number;
}

export function AccountReviewRow({ a }: { a: ReviewAccount }) {
  const { pending, run } = useRunner();
  const [note, setNote] = useState("");
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-white">
          @{a.username} <span className="text-xs font-normal text-muted">· {a.full_name || "no name set"}</span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.is_banned ? "bg-no/15 text-no" : "bg-amber-400/15 text-amber-300"}`}>
          {a.is_banned ? "Suspended" : "Flagged"}
        </span>
      </div>
      <p className="text-xs text-muted">Wallet: {formatNaira(a.balance_kobo)}</p>
      {a.ban_reason && <p className="text-xs text-no">Suspended: {a.ban_reason}</p>}
      {a.flagged_reason && <p className="text-xs text-amber-200">Flag: {a.flagged_reason}</p>}
      {!a.is_banned && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for suspension" className={inputCls} />
      )}
      <div className="grid grid-cols-2 gap-2">
        {a.is_banned ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setAccountStatus(a.id, false, ""), () => `@${a.username} restored.`)}
            className="col-span-2 rounded-xl border border-line py-2 text-sm font-semibold text-white hover:bg-card-2 disabled:opacity-50"
          >
            Lift suspension
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setAccountStatus(a.id, true, note), () => `@${a.username} suspended.`)}
              className="rounded-xl bg-no py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              Suspend
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setAccountStatus(a.id, false, ""), () => "Flag cleared.")}
              className="rounded-xl border border-line py-2 text-sm font-semibold text-white hover:bg-card-2 disabled:opacity-50"
            >
              Clear flag
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/** Live markets with a school picker, so admins can resolve one university at a time. */
export function OpenMarketsBySchool({ markets, schoolOf, now }: { markets: Market[]; schoolOf: Record<string, string>; now: number }) {
  const counts = new Map<string, { total: number; closed: number }>();
  for (const m of markets) {
    const c = counts.get(m.school_id) ?? { total: 0, closed: 0 };
    c.total += 1;
    if (new Date(m.closes_at).getTime() <= now) c.closed += 1;
    counts.set(m.school_id, c);
  }
  const schoolIds = [...counts.keys()].sort((a, b) => (schoolOf[a] ?? a).localeCompare(schoolOf[b] ?? b));
  const [school, setSchool] = useState(schoolIds.length === 1 ? schoolIds[0] : "all");
  const [onlyClosed, setOnlyClosed] = useState(false);
  const shown = markets.filter(
    (m) => (school === "all" || m.school_id === school) && (!onlyClosed || new Date(m.closes_at).getTime() <= now),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          aria-label="Show markets for this university"
          className={`${inputCls} w-auto min-w-56`}
        >
          <option value="all">All universities ({markets.length})</option>
          {schoolIds.map((id) => {
            const c = counts.get(id)!;
            return (
              <option key={id} value={id}>
                {schoolOf[id] ?? id} ({c.total}
                {c.closed ? `, ${c.closed} need a result` : ""})
              </option>
            );
          })}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyClosed} onChange={(e) => setOnlyClosed(e.target.checked)} className="size-4 accent-brand" />
          Only closed (need a result)
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No markets match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((m) => (
            <OpenMarketRow key={m.id} market={m} school={schoolOf[m.school_id] ?? m.school_id} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
