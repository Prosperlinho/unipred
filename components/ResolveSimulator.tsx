"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { formatCP } from "@/lib/format";
import type { Market, Outcome } from "@/lib/types";

/** Demo-mode control that lets the creator settle their own market. */
export function ResolveSimulator({ market }: { market: Market }) {
  const { resolveMarket } = useMarkets();
  const { toast } = useUI();
  const [pending, setPending] = useState<Outcome | null>(null);

  if (!market.createdByUser || market.resolution) return null;

  const confirm = (outcome: Outcome) => {
    if (pending !== outcome) {
      setPending(outcome);
      return;
    }
    const res = resolveMarket(market.id, outcome);
    setPending(null);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(
      `Resolved ${outcome}. ${formatCP(res.value.creatorPayout)} CP (bond + LP pool) returned to you. Claim any winning shares in Portfolio.`,
      "info",
    );
  };

  return (
    <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
        <FlaskConical className="size-4" /> Simulate Market Resolution (Demo Mode)
      </p>
      <p className="mt-1 text-xs text-muted">
        As the creator you can settle this market. Your {market.creatorBond} CP bond is refunded along with the
        pool&apos;s remaining winning shares.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["YES", "NO"] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => confirm(o)}
            onBlur={() => setPending((p) => (p === o ? null : p))}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              o === "YES"
                ? pending === o
                  ? "bg-yes text-black"
                  : "bg-yes/15 text-yes hover:bg-yes/25"
                : pending === o
                  ? "bg-no text-black"
                  : "bg-no/15 text-no hover:bg-no/25"
            }`}
          >
            {pending === o ? `Tap to confirm ${o}` : `Resolve ${o}`}
          </button>
        ))}
      </div>
    </div>
  );
}
