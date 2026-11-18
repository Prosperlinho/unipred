"use client";

import { Check, Clock, Flame, Loader2, RotateCcw, SkipForward, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { placeBet } from "@/app/actions/trade";
import { useUI } from "@/context/UIContext";
import { compactNaira, formatNaira, formatPct, timeLeft } from "@/lib/format";
import { estimateBet, marketProbYes } from "@/lib/pool";
import type { Market, Outcome } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { CategoryBadge } from "./CategoryBadge";

const SWIPE = 90; // px to count as a swipe
const QUICK = [200, 500, 1000, 2000];
const PICKS_KEY = "unipred_picks";

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

/** Tinder-style deck: swipe right for YES, left for NO, up (or Skip) to pass. */
export function QuickPicks({
  markets,
  feeBps,
  loggedIn,
  serverNow,
  schoolLabels,
}: {
  markets: Market[];
  feeBps: number;
  loggedIn: boolean;
  serverNow: number;
  schoolLabels: Record<string, string>;
}) {
  const now = useNow(serverNow);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [fly, setFly] = useState<null | "YES" | "NO" | "SKIP">(null);
  const [choice, setChoice] = useState<Outcome | null>(null);
  const [picks, setPicks] = useState(0);
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PICKS_KEY) ?? "{}") as { day?: string; n?: number };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after mount
      if (saved.day === todayKey()) setPicks(saved.n ?? 0);
    } catch {}
  }, []);

  const deck = useMemo(() => markets.filter((m) => m.status === "open" && new Date(m.closes_at).getTime() > serverNow), [markets, serverNow]);
  const current = deck[index];
  const done = index >= deck.length;

  const advance = () => {
    setFly(null);
    setDrag({ x: 0, y: 0, active: false });
    setIndex((i) => i + 1);
  };
  const throwCard = (dir: "YES" | "NO" | "SKIP") => {
    navigator.vibrate?.(12);
    setFly(dir);
    window.setTimeout(advance, 260);
  };
  const choose = (side: Outcome) => {
    navigator.vibrate?.(12);
    if (!loggedIn) {
      router.push("/signup");
      return;
    }
    setChoice(side);
  };

  const onDown = (e: ReactPointerEvent) => {
    if (fly || choice) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for synthetic or already-released pointers; dragging still works.
    }
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.active) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onUp = () => {
    if (!drag.active) return;
    if (drag.x > SWIPE) {
      setDrag({ x: drag.x, y: drag.y, active: false });
      choose("YES");
    } else if (drag.x < -SWIPE) {
      setDrag({ x: drag.x, y: drag.y, active: false });
      choose("NO");
    } else if (drag.y < -SWIPE) throwCard("SKIP");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const betPlaced = () => {
    const n = picks + 1;
    setPicks(n);
    try {
      localStorage.setItem(PICKS_KEY, JSON.stringify({ day: todayKey(), n }));
    } catch {}
    const side = choice ?? "YES";
    setChoice(null);
    throwCard(side);
  };
  const betCancelled = () => {
    setChoice(null);
    setDrag({ x: 0, y: 0, active: false });
  };

  if (deck.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
        <p className="font-semibold text-white">No live markets right now</p>
        <p className="mt-1 text-sm text-muted">New ones drop all the time. Check back soon.</p>
      </div>
    );
  }

  // Card transform while dragging / flying out.
  const dx = fly === "YES" ? 640 : fly === "NO" ? -640 : drag.x;
  const dy = fly === "SKIP" ? -700 : fly ? drag.y : drag.y * 0.4;
  const rot = fly === "SKIP" ? 0 : dx / 18;
  const yesGlow = Math.max(0, Math.min(1, dx / SWIPE));
  const noGlow = Math.max(0, Math.min(1, -dx / SWIPE));

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span className="tabular-nums">
          {Math.min(index + 1, deck.length)} / {deck.length}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300">
          <Flame className="size-3.5" /> {picks} pick{picks === 1 ? "" : "s"} today
        </span>
      </div>

      <div className="relative h-[400px]">
        {done ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-line bg-card p-6 text-center">
            <p className="text-lg font-extrabold text-white">You&apos;re all caught up 🎉</p>
            <p className="mt-1 text-sm text-muted">That&apos;s every live market for now.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIndex(0)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-white hover:bg-card-2"
              >
                <RotateCcw className="size-4" /> Again
              </button>
              <Link href="/markets" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black">
                All markets
              </Link>
            </div>
          </div>
        ) : (
          deck
            .slice(index, index + 3)
            .reverse()
            .map((m, revI, arr) => {
              const depth = arr.length - 1 - revI; // 0 = top card
              const top = depth === 0;
              const p = marketProbYes(m);
              const closes = new Date(m.closes_at).getTime();
              const pot = Number(m.stake_yes_kobo) + Number(m.stake_no_kobo);
              const yesPays = estimateBet(m, "YES", 100_000, feeBps)?.payoutKobo ?? 0;
              const noPays = estimateBet(m, "NO", 100_000, feeBps)?.payoutKobo ?? 0;
              const style = top
                ? {
                    transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
                    transition: drag.active ? "none" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }
                : {
                    transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`,
                    transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                  };
              return (
                <article
                  key={m.id}
                  data-tour={top ? "deck" : undefined}
                  onPointerDown={top ? onDown : undefined}
                  onPointerMove={top ? onMove : undefined}
                  onPointerUp={top ? onUp : undefined}
                  onPointerCancel={top ? onUp : undefined}
                  className={`absolute inset-0 flex touch-none flex-col overflow-hidden rounded-3xl border bg-card p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)] ${
                    top ? "cursor-grab border-white/10 active:cursor-grabbing" : "border-line"
                  }`}
                  style={{ ...style, zIndex: 10 - depth, opacity: depth > 1 ? 0.6 : 1 }}
                >
                  {/* soft brand glow */}
                  <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/10 blur-3xl" />

                  {top && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-inset ring-yes"
                        style={{ opacity: yesGlow, background: `rgb(47 212 122 / ${yesGlow * 0.12})` }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-inset ring-no"
                        style={{ opacity: noGlow, background: `rgb(255 93 93 / ${noGlow * 0.12})` }}
                      />
                      <span
                        className="pointer-events-none absolute left-5 top-16 -rotate-12 rounded-lg border-4 border-yes px-3 py-1 text-2xl font-black text-yes"
                        style={{ opacity: yesGlow }}
                      >
                        YES
                      </span>
                      <span
                        className="pointer-events-none absolute right-5 top-16 rotate-12 rounded-lg border-4 border-no px-3 py-1 text-2xl font-black text-no"
                        style={{ opacity: noGlow }}
                      >
                        NO
                      </span>
                    </>
                  )}

                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {m.featured_at ? (
                        <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-black">🔥 Market of the day</span>
                      ) : (
                        <span className="truncate text-[13px] font-bold text-cream">{schoolLabels[m.school_id] ?? ""}</span>
                      )}
                      <CategoryBadge category={m.category} />
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                      <Clock className="size-3" /> {timeLeft(closes, now)}
                    </span>
                  </div>

                  <Link
                    href={`/markets/${m.id}`}
                    draggable={false}
                    onClick={(e) => (Math.abs(drag.x) > 5 || Math.abs(drag.y) > 5) && e.preventDefault()}
                    className="relative mt-5 text-2xl font-extrabold leading-tight text-white"
                  >
                    {m.question}
                  </Link>

                  <div className="relative mt-auto">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[11px] text-muted">Chance YES</p>
                        <p className={`text-5xl font-black tabular-nums ${p >= 0.5 ? "text-yes" : "text-no"}`}>{formatPct(p)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold tabular-nums text-white">{compactNaira(pot)}</p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted">
                          <Users className="size-3" /> {m.traders} in the pot
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-line">
                      <div className="rounded-l-full bg-yes" style={{ width: `${p * 100}%` }} />
                      <div className="rounded-r-full bg-no" style={{ width: `${(1 - p) * 100}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
                      <span>₦1k on YES → ~{compactNaira(Number(m.stake_no_kobo) > 0 ? yesPays : 100_000)}</span>
                      <span>₦1k on NO → ~{compactNaira(Number(m.stake_yes_kobo) > 0 ? noPays : 100_000)}</span>
                    </div>
                  </div>
                </article>
              );
            })
        )}
      </div>

      {!done && (
        <>
          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => choose("NO")}
              className="flex size-16 items-center justify-center rounded-full border-2 border-no/50 bg-no/10 text-no shadow-lg transition hover:scale-105 hover:bg-no hover:text-black active:scale-95"
              aria-label="Bet NO"
            >
              <X className="size-7" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => throwCard("SKIP")}
              className="flex size-11 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:text-white active:scale-95"
              aria-label="Skip"
            >
              <SkipForward className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => choose("YES")}
              className="flex size-16 items-center justify-center rounded-full border-2 border-yes/50 bg-yes/10 text-yes shadow-lg transition hover:scale-105 hover:bg-yes hover:text-black active:scale-95"
              aria-label="Bet YES"
            >
              <Check className="size-7" strokeWidth={3} />
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">Swipe right for YES · left for NO · up to skip</p>
        </>
      )}

      {choice && current && (
        <StakeSheet market={current} side={choice} feeBps={feeBps} onDone={betPlaced} onCancel={betCancelled} />
      )}
    </div>
  );
}

function StakeSheet({
  market,
  side,
  feeBps,
  onDone,
  onCancel,
}: {
  market: Market;
  side: Outcome;
  feeBps: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useUI();
  const router = useRouter();
  const [naira, setNaira] = useState(500);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const est = estimateBet(market, side, naira * 100, feeBps);
  const yes = side === "YES";

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const res = await placeBet(market.id, side, naira * 100);
      if (!res.ok) return setError(res.error);
      toast(`${formatNaira(naira * 100)} on ${side} ✓`);
      router.refresh();
      onDone();
    });

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Bet ${side}`}>
      <button type="button" aria-label="Cancel" tabIndex={-1} onClick={onCancel} className="absolute inset-0 animate-fade-in bg-black/70" />
      <div className="relative w-full animate-sheet-up rounded-t-3xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:animate-pop-in sm:rounded-3xl">
        <p className={`text-xs font-bold uppercase tracking-wide ${yes ? "text-yes" : "text-no"}`}>Bet {side}</p>
        <p className="mt-1 line-clamp-2 font-semibold text-white">{market.question}</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setNaira(q)}
              className={`rounded-xl py-2.5 text-sm font-bold tabular-nums transition ${
                naira === q ? (yes ? "bg-yes text-black" : "bg-no text-black") : "border border-line bg-card text-white"
              }`}
            >
              ₦{q.toLocaleString("en-NG")}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-3 py-2.5 text-sm">
          <span className="text-muted">If {side} wins you get ~</span>
          <span className="font-extrabold tabular-nums text-white">{est ? formatNaira(est.payoutKobo) : "—"}</span>
        </div>
        {error && <p className="mt-2 text-sm text-no">{error}</p>}

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 font-extrabold text-black transition hover:brightness-110 disabled:opacity-60 ${
              yes ? "bg-yes" : "bg-no"
            }`}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Bet ₦{naira.toLocaleString("en-NG")} on {side}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">18+ · Only stake what you can afford to lose.</p>
      </div>
    </div>,
    document.body,
  );
}
