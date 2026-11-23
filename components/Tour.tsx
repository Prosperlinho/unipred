"use client";

import { ArrowLeft, ArrowRight, Pointer, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Fire this anywhere to (re)start the walkthrough. */
export const TOUR_EVENT = "unipred:tour";
export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}
/** Fired when the walkthrough is running / closed, so other pop-ups can wait their turn. */
export const TOUR_STATE_EVENT = "unipred:tour-state";

interface Step {
  /** Matches data-tour="..." on the element to spotlight. */
  target: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { target: "deck", title: "Swipe to call it", text: "Swipe right for YES, left for NO, up to skip. Pick an amount and you're in." },
  { target: "markets", title: "All markets", text: "Browse every live market, filtered to what you're into." },
  { target: "wallet", title: "Your wallet", text: "Deposit, withdraw to your own bank, or send money to a friend." },
  { target: "portfolio", title: "Your bets", text: "Track open bets and results, and download your win cards." },
  { target: "leaderboard", title: "Leaderboard", text: "See the top predictors this week and of all time." },
  { target: "propose", title: "Propose a market", text: "Turn campus gist into a new market." },
  { target: "profile", title: "Invite & earn", text: "Your invite link, settings and bank account live here." },
  { target: "guide", title: "Need help?", text: "Tap ? any time for answers, or to replay this tour." },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 300;

/** First matching element that is actually visible (e.g. bottom nav on phones, header nav on desktop). */
function findTarget(name: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    }) ?? null
  );
}

function measure(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

function Walkthrough({ onClose }: { onClose: () => void }) {
  // Only the steps whose element exists on this screen (logged-out visitors have no wallet, etc.).
  const steps = useMemo(() => STEPS.filter((s) => findTarget(s.target)), []);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const step = steps[index];
  const last = index === steps.length - 1;
  const frame = useRef(0);

  // Scroll the target into view, then follow it every frame so the spotlight glides with smooth scrolling.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fixed = getComputedStyle(el).position === "fixed" || el.closest("header, nav[aria-label='Primary']");
    if (!fixed && (r.top < 80 || r.bottom > window.innerHeight - 220)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const tick = () => {
      const next = measure(el);
      setBox((prev) =>
        prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && prev.width === next.width
          ? prev
          : next,
      );
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [step]);

  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  if (!step || !box) return null;

  // Tip card goes below the spotlight if there's room, otherwise above it.
  const cardW = Math.min(CARD_W, viewport.w - 24);
  const below = viewport.h - (box.top + box.height) > 210;
  const cardTop = below ? box.top + box.height + 14 : Math.max(12, box.top - 14 - 190);
  const center = box.left + box.width / 2;
  const cardLeft = Math.min(Math.max(12, center - cardW / 2), viewport.w - cardW - 12);
  const arrowLeft = Math.min(Math.max(18, center - cardLeft), cardW - 18);
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Click shield: keeps people in the tour until they skip or finish */}
      <div className="absolute inset-0" />

      {/* Spotlight: a hole in the dark overlay that glides between targets */}
      <div
        className="pointer-events-none absolute rounded-2xl"
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          boxShadow: "0 0 0 9999px rgb(3 10 7 / 0.78), 0 0 0 2px var(--color-brand), 0 0 32px 6px rgb(198 244 50 / 0.35)",
          transition: `top 520ms ${ease}, left 520ms ${ease}, width 520ms ${ease}, height 520ms ${ease}`,
        }}
      >
        <span className="absolute inset-0 animate-ping rounded-2xl ring-2 ring-brand/60 [animation-duration:1.8s]" />
      </div>

      {/* Animated pointer that travels with the spotlight */}
      <div
        className="pointer-events-none absolute text-brand drop-shadow-[0_4px_12px_rgb(198_244_50/0.5)]"
        style={{
          top: Math.min(box.top + box.height - 10, viewport.h - 44),
          left: Math.min(box.left + box.width - 18, viewport.w - 40),
          transition: `top 520ms ${ease}, left 520ms ${ease}`,
        }}
      >
        <Pointer className="size-8 animate-bounce fill-brand/20" strokeWidth={2.2} />
      </div>

      {/* Tip card */}
      <div
        key={step.target}
        className="absolute animate-pop-in rounded-2xl border border-brand/30 bg-card p-4 shadow-2xl"
        style={{ top: cardTop, left: cardLeft, width: cardW, transition: `top 520ms ${ease}, left 520ms ${ease}` }}
      >
        <span
          className={`absolute size-3 rotate-45 border-brand/30 bg-card ${below ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r"}`}
          style={{ left: arrowLeft - 6 }}
        />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
            {index + 1} / {steps.length}
          </p>
          <button type="button" onClick={onClose} className="-m-1 rounded-full p-1 text-muted hover:text-white" aria-label="Skip tour">
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 font-bold text-white">
          {step.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-white/75">{step.text}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.target}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-5 bg-brand" : i < index ? "w-1.5 bg-brand/50" : "w-1.5 bg-line"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="flex items-center rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-card-2"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-bold text-black transition hover:brightness-110"
            >
              {last ? "Done" : "Next"}
              {!last && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Mounted once in the app shell. Starts automatically for brand-new members (autoStart),
 * and whenever startTour() is called (e.g. from the guide).
 */
export function TourHost({ autoStart = false, onFinish }: { autoStart?: boolean; onFinish?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [running, setRunning] = useState(false);
  const [requested, setRequested] = useState(autoStart);

  // The tour lives on the home page, where the markets are.
  useEffect(() => {
    const onStart = () => setRequested(true);
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (!requested) return;
    if (pathname !== "/") {
      router.push("/");
      return;
    }
    // Give the page a moment to render its cards before measuring.
    const t = window.setTimeout(() => {
      setRequested(false);
      setRunning(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [requested, pathname, router]);

  const close = useCallback(() => {
    setRunning(false);
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    const busy = running || requested;
    window.dispatchEvent(new CustomEvent(TOUR_STATE_EVENT, { detail: busy }));
    (window as Window & { __unipredTour?: boolean }).__unipredTour = busy;
  }, [running, requested]);

  return running ? <Walkthrough onClose={close} /> : null;
}
