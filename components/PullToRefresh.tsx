"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BrandLoader } from "./BrandLoader";

const THRESHOLD = 72; // px of pull needed to refresh
const MAX = 110;
/** Touches that start here never pull: swipe cards, pop-ups, form fields, sliders. */
const IGNORE = '[data-tour="deck"], [role="dialog"], [data-no-pull], input, textarea, select, [role="slider"]';

/**
 * Pull down at the top of any page to refresh it. The UniPred logo fills up as you pull,
 * then plays the loading animation while fresh data loads.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();
  const start = useRef<{ y: number; x: number } | null>(null);
  const pullRef = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return;
      if (window.scrollY > 0 || document.body.style.overflow === "hidden") return;
      if ((e.target as Element | null)?.closest?.(IGNORE)) return;
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (pullRef.current) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      // Resistance: the further you pull, the slower it moves.
      const d = Math.min(MAX, dy * 0.5);
      pullRef.current = d;
      setPull(d);
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        startedAt.current = Date.now();
        startTransition(() => router.refresh());
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing, router]);

  // Hide once the new data is in (show the animation for at least one full loop).
  useEffect(() => {
    if (!refreshing || pending) return;
    const wait = Math.max(0, 1400 - (Date.now() - startedAt.current));
    const t = window.setTimeout(() => setRefreshing(false), wait);
    return () => window.clearTimeout(t);
  }, [refreshing, pending]);

  const visible = refreshing || pull > 4;
  if (!visible) return null;
  const offset = refreshing ? 64 : pull;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-[45] flex justify-center"
      style={{ transform: `translateY(${offset - 48}px)`, transition: refreshing ? "transform 0.25s ease-out" : "none" }}
      aria-live="polite"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-card shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)]">
        {refreshing ? <BrandLoader size={26} label="Refreshing" /> : <BrandLoader size={26} progress={pull / THRESHOLD} label="Pull to refresh" />}
      </span>
    </div>
  );
}
