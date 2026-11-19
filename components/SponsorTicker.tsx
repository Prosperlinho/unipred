"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SponsorBanner } from "@/lib/types";

const ROTATE_MS = 4000;

/**
 * Slim sponsor strip pinned under the header on every page. It stays visible while scrolling,
 * swipes horizontally to the next sponsor every few seconds, and can't be dismissed.
 */
export function SponsorTicker({ banners }: { banners: SponsorBanner[] }) {
  const [index, setIndex] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="sticky top-14 z-30 border-b border-line bg-bg/95 backdrop-blur" role="region" aria-label="Sponsors">
      <div className="mx-auto max-w-6xl overflow-hidden">
        <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {banners.map((b, i) => {
            const inner = (
              <>
                {b.image_url ? (
                  // Sponsor images come from our storage bucket or a link the admin pastes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_url} alt="" className="h-7 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-7 w-16 shrink-0 items-center justify-center rounded-md bg-brand/15 text-[10px] font-black text-brand">
                    {b.sponsor.slice(0, 8)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs">
                  <span className="mr-1.5 rounded bg-white/10 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">Ad</span>
                  <b className="text-cream">{b.sponsor}</b>
                  <span className="text-white/80"> · {b.title}</span>
                </span>
                {b.link_url && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-black">
                    {b.cta || "Open"} <ArrowUpRight className="size-3" />
                  </span>
                )}
              </>
            );
            const cls = "flex w-full shrink-0 items-center gap-2.5 px-3 py-1.5 sm:px-4";
            return b.link_url ? (
              <a
                key={b.id}
                href={b.link_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={cls}
                tabIndex={i === index ? 0 : -1}
                aria-hidden={i !== index}
              >
                {inner}
              </a>
            ) : (
              <Link key={b.id} href="/sponsors" className={cls} tabIndex={i === index ? 0 : -1} aria-hidden={i !== index}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
