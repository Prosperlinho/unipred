"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SponsorBanner as Banner } from "@/lib/types";
import { SponsorBanner } from "./SponsorBanner";

const ROTATE_MS = 6000;

/**
 * Every live sponsor gets a turn: auto-rotates every 6s (pauses on hover/touch),
 * with dots to jump and swipe support on phones. One banner renders as a plain card.
 */
export function SponsorCarousel({ banners, className = "" }: { banners: Banner[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;
  const allLink = (
    <Link href="/sponsors" className="text-[11px] font-semibold text-muted hover:text-brand">
      All sponsors →
    </Link>
  );
  if (count === 1)
    return (
      <div className={className}>
        <SponsorBanner banner={banners[0]} />
        <div className="mt-1.5 text-right">{allLink}</div>
      </div>
    );

  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - (startX.current ?? 0);
        if (startX.current !== null && Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        startX.current = null;
        setPaused(false);
      }}
      aria-roledescription="carousel"
      aria-label="Sponsors"
    >
      <div className="overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {banners.map((b, i) => (
            <div key={b.id} className="w-full shrink-0" aria-hidden={i !== index} inert={i !== index}>
              <SponsorBanner banner={b} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="w-24 shrink-0" />
        <div className="flex justify-center gap-1.5">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-white/20 hover:bg-white/40"}`}
            aria-label={`Show sponsor ${i + 1} of ${count}`}
            aria-current={i === index}
          />
        ))}
        </div>
        <span className="w-24 shrink-0 whitespace-nowrap text-right">{allLink}</span>
      </div>
    </div>
  );
}
