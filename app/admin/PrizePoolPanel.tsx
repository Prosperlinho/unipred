"use client";

import { Loader2, Trophy } from "lucide-react";
import { useState, useTransition } from "react";
import { payWeeklyPrizes, setWeeklyPool } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";

export interface PoolWeek {
  weekStart: string;
  label: string;
  poolKobo: number;
  status: "none" | "open" | "paid";
  ended: boolean;
  standings: Array<{ rank: number; username: string; profitKobo: number; markets: number | null; prizeKobo: number }>;
}

const SPLIT = ["40%", "25%", "15%", "12%", "8%"];

function PoolEditor({ week }: { week: PoolWeek }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [naira, setNaira] = useState(week.poolKobo ? String(week.poolKobo / 100) : "");
  const paid = week.status === "paid";
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₦</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={naira}
          disabled={paid}
          onChange={(e) => setNaira(e.target.value)}
          placeholder="Prize pool"
          aria-label={`Prize pool for ${week.label}`}
          className={`${inputCls} pl-7`}
        />
      </div>
      <button
        type="button"
        disabled={pending || paid}
        onClick={() =>
          startTransition(async () => {
            const res = await setWeeklyPool(week.weekStart, Number(naira) || 0);
            toast(res.ok ? "Prize pool saved." : res.error, res.ok ? "success" : "error");
          })
        }
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Save
      </button>
    </div>
  );
}

/** Weekly prize pool: set the pool, watch the standings, pay the winners after review. */
export function PrizePoolPanel({ weeks }: { weeks: PoolWeek[] }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {weeks.map((w) => {
        const total = w.standings.reduce((s, r) => s + r.prizeKobo, 0);
        const canPay = w.ended && w.status === "open" && w.poolKobo > 0 && w.standings.length > 0;
        return (
          <article key={w.weekStart} className="space-y-3 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-white">{w.label}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  w.status === "paid" ? "bg-yes/15 text-yes" : w.ended ? "bg-amber-400/15 text-amber-300" : "bg-brand/10 text-brand"
                }`}
              >
                {w.status === "paid" ? "Paid" : w.ended ? "Ready to review" : "Running"}
              </span>
            </div>
            <PoolEditor week={w} />
            {w.poolKobo > 0 && (
              <ol className="space-y-1.5 text-sm">
                {SPLIT.map((pct, i) => {
                  const r = w.standings.find((s) => s.rank === i + 1);
                  return (
                    <li key={pct} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="mr-1.5 text-xs font-bold text-muted">#{i + 1}</span>
                        {r ? (
                          <span className="font-semibold text-white">
                            @{r.username} <span className="text-xs font-normal text-muted">+{formatNaira(r.profitKobo)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted">nobody qualifies yet</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-brand">
                        {r ? formatNaira(r.prizeKobo) : pct}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {canPay && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  confirm(`Pay ${formatNaira(total)} to ${w.standings.length} winner(s)? This credits their wallets and can't be undone.`) &&
                  startTransition(async () => {
                    const res = await payWeeklyPrizes(w.weekStart);
                    toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yes py-2.5 text-sm font-extrabold text-black disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />} Pay winners {formatNaira(total)}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
