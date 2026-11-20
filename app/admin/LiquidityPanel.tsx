"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setMarketLiquidity } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";

const PRESETS = [100_000, 200_000, 300_000, 500_000];

/** Admin box for the house liquidity each new live-price market starts with. */
export function LiquidityPanel({ currentKobo, openMarkets, openLiquidityKobo }: { currentKobo: number; openMarkets: number; openLiquidityKobo: number }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [naira, setNaira] = useState(String(currentKobo / 100));
  const value = Number(naira) || 0;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">
        Each new market starts with this much house money split 50/50. More liquidity = odds move less per bet. The house can lose up to
        about this amount on a market.
      </p>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₦</span>
          <input
            type="number"
            inputMode="numeric"
            min={10000}
            max={5000000}
            step={10000}
            value={naira}
            onChange={(e) => setNaira(e.target.value)}
            aria-label="Liquidity per new market"
            className={`${inputCls} pl-7`}
          />
        </div>
        <button
          type="button"
          disabled={pending || value * 100 === currentKobo}
          onClick={() =>
            startTransition(async () => {
              const res = await setMarketLiquidity(value);
              toast(res.ok ? `New markets will start with ${formatNaira(value * 100)}.` : res.error, res.ok ? "success" : "error");
            })
          }
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setNaira(String(p))}
            className={`rounded-lg border py-1.5 text-xs font-semibold transition ${value === p ? "border-brand bg-brand/10 text-brand" : "border-line bg-bg text-white hover:bg-card-2"}`}
          >
            ₦{p / 1000}k
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        Now: <b className="text-white">{formatNaira(currentKobo)}</b> per new market · {openMarkets} open live-price market{openMarkets === 1 ? "" : "s"}{" "}
        holding {formatNaira(openLiquidityKobo)} of house liquidity (the most the house could lose on them). Changes apply to markets created after you save.
      </p>
    </div>
  );
}
