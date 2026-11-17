import type { CSSProperties } from "react";
import type { Market } from "@/lib/types";
import { LogoMark } from "./Logo";
import { HeroActions } from "./hero/HeroActions";
import { HeroBackground } from "./hero/HeroBackground";
import { HeroLiveCard } from "./hero/HeroLiveCard";

/** Staggered entrance: 0.3s initial delay, 0.15s between children. */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${0.3 + i * 0.15}s` });

interface Props {
  loggedIn: boolean;
  topMarket: Market | null;
  topSchoolLabel?: string;
}

export function Hero({ loggedIn, topMarket, topSchoolLabel }: Props) {
  return (
    <section className="relative w-full overflow-hidden bg-bg" aria-labelledby="hero-title">
      <HeroBackground />

      {/* Overlay stack keeps the left-aligned copy legible */}
      <div className="absolute inset-0 z-0 bg-black/30" aria-hidden />
      <div className="absolute inset-0 z-0 bg-linear-to-r from-bg/95 via-bg/60 to-transparent" aria-hidden />
      <div className="absolute inset-0 z-0 bg-linear-to-t from-bg via-transparent to-transparent" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[560px] max-w-6xl flex-col justify-center px-4 pb-24 pt-10 lg:min-h-[640px]">
        <div className="flex items-center justify-between gap-12">
          <div className="max-w-2xl">
            <p
              className="mb-6 animate-hero-rise text-sm font-medium tracking-wide text-brand md:text-base"
              style={stagger(0)}
            >
              Your Campus. Your Calls.
            </p>

            <h1
              id="hero-title"
              className="mb-8 animate-hero-rise font-serif text-3xl font-normal leading-[1.1] text-white md:text-4xl lg:text-5xl"
              style={stagger(1)}
            >
              Call It Before It Happens,
              <br />
              <em className="italic">Predict Your Campus.</em>
            </h1>

            <div className="mb-8 flex animate-hero-rise items-center gap-3" style={stagger(2)} aria-hidden>
              <LogoMark className="h-6 w-auto" />
              <span className="h-px w-32 bg-brand/30" />
            </div>

            <p
              className="mb-10 max-w-lg animate-hero-rise text-lg font-light leading-relaxed text-white/80 md:text-xl"
              style={stagger(3)}
            >
              Find your university, back your read on SUG elections, results, matches and campus gist, and get paid
              in naira when you&apos;re right.
            </p>

            <div className="animate-hero-rise" style={stagger(4)}>
              <HeroActions loggedIn={loggedIn} />
            </div>
          </div>

          <HeroLiveCard market={topMarket} schoolLabel={topSchoolLabel} />
        </div>
      </div>
    </section>
  );
}
