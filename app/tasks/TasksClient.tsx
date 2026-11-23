"use client";

import { ArrowUpRight, Check, Flame, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimStreak, claimTask } from "@/app/actions/rewards";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";

export interface RewardTask {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: string;
  reward_kobo: number;
  claimed: boolean;
}

export interface RewardStatus {
  today: string;
  current_streak: number;
  next_day: number;
  claimed_today: boolean;
  bet_today: boolean;
  rewards_kobo: number[];
  next_reward_kobo: number;
  tasks: RewardTask[];
}

/** Daily betting streak: a 7-day ladder, claimable once a day after placing a bet. */
export function StreakCard({ status }: { status: RewardStatus }) {
  const { toast } = useUI();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ladder = status.rewards_kobo.length || 7;
  // Which rung of the ladder is "today" (claimed) or "next" (to claim).
  const todayDay = status.claimed_today ? status.current_streak : status.next_day;
  const rung = ((todayDay - 1) % ladder) + 1;

  const claim = () =>
    startTransition(async () => {
      const res = await claimStreak();
      toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-linear-to-br from-amber-400/10 via-card to-card">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
            <Flame className="size-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Betting streak</p>
            <p className="text-2xl font-extrabold tabular-nums text-white">
              {status.current_streak} day{status.current_streak === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{status.claimed_today ? "Tomorrow" : "Today's reward"}</p>
          <p className="text-lg font-extrabold tabular-nums text-amber-300">
            {formatNaira(status.claimed_today ? status.rewards_kobo[rung % ladder] ?? 0 : status.next_reward_kobo)}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-7 gap-1.5 px-4 sm:px-5" aria-label="7-day streak rewards">
        {status.rewards_kobo.map((k, i) => {
          const day = i + 1;
          const done = day < rung || (day === rung && status.claimed_today);
          const current = day === rung && !status.claimed_today;
          return (
            <li
              key={day}
              className={`flex flex-col items-center rounded-xl border px-0.5 py-2 text-center ${
                done ? "border-amber-400/40 bg-amber-400/15" : current ? "border-amber-300 bg-amber-300/10" : "border-line bg-bg"
              }`}
            >
              <span className="text-[10px] font-semibold text-muted">Day {day}</span>
              {done ? <Check className="my-0.5 size-4 text-amber-300" /> : <Flame className={`my-0.5 size-4 ${current ? "text-amber-300" : "text-white/25"}`} />}
              <span className={`text-[10px] font-bold tabular-nums sm:text-xs ${done || current ? "text-white" : "text-muted"}`}>
                ₦{Math.round(k / 100).toLocaleString("en-NG")}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="p-4 sm:p-5">
        {status.claimed_today ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-bg py-3 text-sm font-semibold text-white">
            <Check className="size-4 text-yes" /> Claimed today. Bet again tomorrow to keep it going.
          </p>
        ) : status.bet_today ? (
          <button
            type="button"
            onClick={claim}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 py-3 font-extrabold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Claim Day {status.next_day} · {formatNaira(status.next_reward_kobo)}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-bg py-3 text-sm text-muted">
              <Lock className="size-4" /> Place a bet today to unlock today&apos;s claim
            </p>
            <Link href="/" className="block rounded-2xl bg-brand py-3 text-center font-extrabold text-black transition hover:brightness-110">
              Place a bet
            </Link>
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-muted">Miss a day and your streak starts again from Day 1. Days run midnight to midnight, Lagos time.</p>
      </div>
    </section>
  );
}

const PLATFORM: Record<string, { label: string; cls: string }> = {
  x: { label: "X", cls: "bg-white text-black" },
  instagram: { label: "IG", cls: "bg-linear-to-br from-amber-400 via-pink-500 to-purple-600 text-white" },
  tiktok: { label: "TT", cls: "bg-black text-white ring-1 ring-white/20" },
  whatsapp: { label: "WA", cls: "bg-[#25D366] text-white" },
  telegram: { label: "TG", cls: "bg-[#229ED9] text-white" },
  youtube: { label: "YT", cls: "bg-[#FF0000] text-white" },
  facebook: { label: "FB", cls: "bg-[#1877F2] text-white" },
  other: { label: "↗", cls: "bg-card-2 text-white" },
};

const OPENED_KEY = "unipred_tasks_opened";

function readOpened(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** One-time social tasks: open the link, come back, claim. */
export function TaskList({ tasks }: { tasks: RewardTask[] }) {
  const { toast } = useUI();
  const router = useRouter();
  const [opened, setOpened] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // Remember which links were opened, so "Claim" stays available after they come back.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpened(readOpened());
  }, []);

  const markOpened = (id: string) => {
    const next = [...new Set([...opened, id])];
    setOpened(next);
    try {
      localStorage.setItem(OPENED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const claim = async (id: string) => {
    setBusyId(id);
    const res = await claimTask(id);
    setBusyId(null);
    toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
    if (res.ok) router.refresh();
  };

  const left = tasks.filter((t) => !t.claimed).length;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        Social tasks
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{left} left</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No tasks right now. Check back soon.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {tasks.map((t) => {
            const p = PLATFORM[t.platform] ?? PLATFORM.other;
            const wasOpened = opened.includes(t.id);
            return (
              <li key={t.id} className="flex items-center gap-3 p-3 sm:p-4">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ${p.cls}`}>{p.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{t.title}</p>
                  {t.description && <p className="line-clamp-1 text-xs text-muted">{t.description}</p>}
                  <p className="mt-0.5 text-xs font-bold text-amber-300">+{formatNaira(t.reward_kobo)}</p>
                </div>
                {t.claimed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yes/15 px-3 py-1.5 text-xs font-bold text-yes">
                    <Check className="size-3.5" /> Done
                  </span>
                ) : wasOpened ? (
                  <button
                    type="button"
                    onClick={() => void claim(t.id)}
                    disabled={busyId === t.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-300 px-3.5 py-1.5 text-xs font-extrabold text-black disabled:opacity-60"
                  >
                    {busyId === t.id && <Loader2 className="size-3.5 animate-spin" />} Claim
                  </button>
                ) : (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markOpened(t.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-xs font-extrabold text-black"
                  >
                    Go <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-[11px] text-muted">Each task pays once per account. Tap Go, complete it, then come back and tap Claim.</p>
    </section>
  );
}
