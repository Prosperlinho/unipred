"use client";

import { useState } from "react";
import { compactNaira, formatNaira } from "@/lib/format";

export interface DailyStat {
  day: string; // YYYY-MM-DD (Lagos)
  signups: number;
  bettors: number;
  volume: number; // kobo
  deposits: number; // kobo
}

type Metric = "volume" | "bettors" | "signups" | "deposits";
const METRICS: Array<{ id: Metric; label: string; money: boolean }> = [
  { id: "volume", label: "Money bet", money: true },
  { id: "bettors", label: "Bettors", money: false },
  { id: "signups", label: "Sign-ups", money: false },
  { id: "deposits", label: "Deposits", money: true },
];

// Bar fill: a deeper lime step that sits inside the dark-mode lightness band; hover uses the brand lime.
const BAR = "#7aa61a";
const BAR_HOVER = "#c6f432";
const CHART_H = 160;

const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

/** 14-day bar chart with a metric switch, hover tooltip and a screen-reader table. */
export function DailyChart({ daily }: { daily: DailyStat[] }) {
  const [metric, setMetric] = useState<Metric>("volume");
  const [hover, setHover] = useState<number | null>(null);
  const m = METRICS.find((x) => x.id === metric)!;
  const values = daily.map((d) => Number(d[metric]) || 0);
  const max = Math.max(1, ...values);
  const fmt = (v: number) => (m.money ? compactNaira(v) : v.toLocaleString("en-NG"));
  const total = values.reduce((a, b) => a + b, 0);
  const h = hover ?? values.length - 1;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-full bg-bg p-0.5" role="tablist" aria-label="Chart metric">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={metric === x.id}
              onClick={() => setMetric(x.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${metric === x.id ? "bg-card-2 text-white" : "text-muted hover:text-white"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          14 days: <span className="font-bold text-white">{m.money ? formatNaira(total) : total.toLocaleString("en-NG")}</span>
        </p>
      </div>

      {/* Readout for the hovered (or latest) day */}
      <p className="mb-2 text-sm">
        <span className="text-muted">{dayLabel(daily[h]?.day ?? "", { weekday: "short", day: "numeric", month: "short" })}: </span>
        <span className="font-bold tabular-nums text-white">{m.money ? formatNaira(values[h] ?? 0) : (values[h] ?? 0).toLocaleString("en-NG")}</span>
        <span className="text-muted"> {m.label.toLowerCase()}</span>
      </p>

      <div className="relative" style={{ height: CHART_H }} aria-hidden onMouseLeave={() => setHover(null)}>
        {/* Recessive grid: top and middle */}
        {[1, 0.5].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-white/[0.07]" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted">{fmt(max * g)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/15" />
        <div className="absolute inset-0 flex items-end gap-[2px] pr-10">
          {values.map((v, i) => (
            <button
              key={daily[i].day}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              className="flex h-full flex-1 items-end justify-center"
            >
              <span
                className="block w-full max-w-7 rounded-t-[4px] transition-colors"
                style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0, background: i === h ? BAR_HOVER : BAR }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pr-10 text-[10px] text-muted" aria-hidden>
        {daily.map((d, i) => (
          <span key={d.day} className="flex-1 text-center tabular-nums">
            {i % 2 === (daily.length - 1) % 2 ? dayLabel(d.day, { day: "numeric" }) : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{m.label} per day, last 14 days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>{m.label}</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d, i) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{m.money ? formatNaira(values[i]) : values[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Top categories by money bet (30 days) as thin horizontal bars. */
export function TopCategories({ rows }: { rows: Array<{ category: string; markets: number; volume: number }> }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.volume)));
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h3 className="mb-3 text-sm font-bold text-white">Top categories · 30 days</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No bets yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-white/90">{r.category}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {compactNaira(Number(r.volume))} · {r.markets} mkt{r.markets === 1 ? "" : "s"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06]">
                <div className="h-2 rounded-full" style={{ width: `${(Number(r.volume) / max) * 100}%`, background: BAR }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
