import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { marketProbYes } from "@/lib/pool";
import { compactNaira } from "@/lib/format";
import type { Market } from "@/lib/types";
import { ProbabilityBar } from "../ProbabilityBar";

/** Desktop-only card on the right of the hero showing the hottest live market. */
export function HeroLiveCard({ market, schoolLabel }: { market: Market | null; schoolLabel?: string }) {
  if (!market) return null;
  return (
    <div className="hidden w-80 shrink-0 xl:block">
      <Link
        href={`/markets/${market.id}`}
        className="group block w-full animate-hero-rise rounded-2xl border border-white/10 bg-bg/60 p-5 backdrop-blur-md transition-colors hover:border-white/25"
        style={{ animationDelay: "1.05s" }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-medium tracking-wide text-brand-gold">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-yes opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-yes" />
            </span>
            Trending{schoolLabel ? ` at ${schoolLabel}` : " now"}
          </span>
          <span className="tabular-nums text-white/60">{compactNaira(market.volume_kobo)} in pot</span>
        </div>
        <p className="mt-3 font-serif text-lg leading-snug text-white">{market.question}</p>
        <div className="mt-4">
          <ProbabilityBar probYes={marketProbYes(market)} />
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
          Trade this market
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </p>
      </Link>
    </div>
  );
}
