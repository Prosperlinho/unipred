"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Gift,
  HandCoins,
  Receipt,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Target,
  Trophy,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatSignedNaira } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";

const KIND: Record<string, { title: string; Icon: LucideIcon; tone: string }> = {
  deposit: { title: "Deposit", Icon: ArrowDownToLine, tone: "bg-yes/15 text-yes" },
  withdrawal: { title: "Withdrawal", Icon: ArrowUpFromLine, tone: "bg-white/10 text-white" },
  withdrawal_refund: { title: "Withdrawal returned", Icon: Undo2, tone: "bg-amber-400/15 text-amber-300" },
  trade_buy: { title: "Bet placed", Icon: Target, tone: "bg-brand/15 text-brand" },
  trade_sell: { title: "Cashed out", Icon: HandCoins, tone: "bg-sky-400/15 text-sky-300" },
  payout: { title: "Winnings", Icon: Trophy, tone: "bg-yes/15 text-yes" },
  refund: { title: "Refund", Icon: RotateCcw, tone: "bg-amber-400/15 text-amber-300" },
  referral: { title: "Invite bonus", Icon: Users, tone: "bg-pink-400/15 text-pink-300" },
  transfer_in: { title: "Received", Icon: Send, tone: "bg-yes/15 text-yes" },
  transfer_out: { title: "Sent", Icon: Send, tone: "bg-white/10 text-white" },
  bonus: { title: "Welcome bonus", Icon: Gift, tone: "bg-brand/15 text-brand" },
  prize: { title: "Weekly prize", Icon: Trophy, tone: "bg-amber-400/15 text-amber-300" },
  adjustment: { title: "Adjustment", Icon: SlidersHorizontal, tone: "bg-white/10 text-white" },
};
const FALLBACK = { title: "Transaction", Icon: Ban, tone: "bg-white/10 text-white" };

type Tab = "All" | "In" | "Out" | "Bets";
const TABS: Tab[] = ["All", "In", "Out", "Bets"];
const BET_KINDS = new Set(["trade_buy", "trade_sell", "payout", "refund"]);
const PAGE = 8;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

/** Compact activity list: icons, grouped by day, filter tabs, and "Show more" instead of an endless page. */
export function Activity({ ledger }: { ledger: LedgerEntry[] }) {
  const [tab, setTab] = useState<Tab>("All");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(
    () =>
      ledger.filter((l) =>
        tab === "All" ? true : tab === "Bets" ? BET_KINDS.has(l.kind) : tab === "In" ? l.amount_kobo > 0 : l.amount_kobo < 0,
      ),
    [ledger, tab],
  );
  const visible = filtered.slice(0, shown);
  const groups: Array<{ day: string; rows: LedgerEntry[] }> = [];
  for (const l of visible) {
    const day = dayLabel(l.created_at);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.rows.push(l);
    else groups.push({ day, rows: [l] });
  }

  return (
    <section className="rounded-3xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 font-bold text-white">
          <Receipt className="size-4 text-muted" /> Activity
        </h2>
        <div className="flex rounded-full bg-bg p-0.5" role="tablist" aria-label="Filter activity">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setShown(PAGE);
              }}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${tab === t ? "bg-card-2 text-white" : "text-muted hover:text-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">Nothing here yet.</p>
      ) : (
        <div className="px-2 pb-2">
          {groups.map((g) => (
            <div key={g.day}>
              <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.day}</p>
              <ul>
                {g.rows.map((l) => {
                  const k = KIND[l.kind] ?? FALLBACK;
                  const row = (
                    <>
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                        <k.Icon className={`size-4 ${l.kind === "transfer_in" ? "rotate-180" : ""}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{k.title}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {time(l.created_at)} · {l.description}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${l.amount_kobo >= 0 ? "text-yes" : "text-white"}`}>
                        {formatSignedNaira(l.amount_kobo)}
                      </span>
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {l.market_id ? (
                        <Link href={`/markets/${l.market_id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-card-2">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filtered.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + 15)}
              className="mt-2 w-full rounded-2xl bg-bg py-2.5 text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Show more ({filtered.length - shown})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
