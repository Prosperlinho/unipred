"use client";

import { ArrowRight } from "lucide-react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { probYes } from "@/lib/amm";
import { compactCP } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { ProbabilityBar } from "../ProbabilityBar";

/** Desktop-only card on the right of the hero showing the hottest live market. */
export function HeroLiveCard() {
  const { hydrated, markets } = useMarkets();
  const { openMarket } = useUI();
  const now = useNow();

  if (!hydrated) return null;
  const top = markets
    .filter((m) => !m.resolution && m.closesAt > now)
    .reduce<(typeof markets)[number] | null>((best, m) => (!best || m.volume > best.volume ? m : best), null);
  if (!top) return null;

  return (
    <div className="hidden w-80 shrink-0 xl:block">
      <button
        type="button"
        onClick={() => openMarket(top.id)}
        className="group w-full animate-hero-rise rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left backdrop-blur-md transition-colors hover:border-white/25"
        style={{ animationDelay: "1.05s" }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-medium tracking-wide text-brand-gold">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-yes opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-yes" />
            </span>
            Trending now
          </span>
          <span className="tabular-nums text-white/60">{compactCP(top.volume)} CP vol</span>
        </div>
        <p className="mt-3 font-serif text-lg leading-snug text-white">{top.question}</p>
        <div className="mt-4">
          <ProbabilityBar probYes={probYes(top)} />
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal">
          Trade this market
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </p>
      </button>
    </div>
  );
}
