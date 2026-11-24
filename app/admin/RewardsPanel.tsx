"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTask, saveTask, setStreakRewards, type TaskInput } from "@/app/actions/rewards";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: string;
  reward_kobo: number;
  active: boolean;
  claims: number;
}

const PLATFORMS = [
  ["x", "X (Twitter)"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["other", "Other"],
] as const;

function StreakEditor({ rewardsKobo, claimsToday, paidWeekKobo }: { rewardsKobo: number[]; claimsToday: number; paidWeekKobo: number }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [vals, setVals] = useState(rewardsKobo.map((k) => String(k / 100)));
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-white">Daily trading streak</p>
        <p className="text-xs text-muted">
          {claimsToday} claimed today · {formatNaira(paidWeekKobo)} paid in the last 7 days
        </p>
      </div>
      <p className="text-xs text-muted">Members claim once a day after making a trade. Reward for each day of the 7-day ladder (₦):</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {vals.map((v, i) => (
          <label key={i} className="text-center">
            <span className="text-[10px] font-semibold text-muted">Day {i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={v}
              onChange={(e) => setVals((old) => old.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${inputCls} px-2 text-center`}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setStreakRewards(vals.map((v) => Number(v) || 0));
            toast(res.ok ? "Streak rewards saved." : res.error, res.ok ? "success" : "error");
          })
        }
        className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Save streak rewards
      </button>
    </div>
  );
}

function TaskEditor({ task, onDone }: { task?: AdminTask; onDone?: () => void }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<TaskInput>({
    id: task?.id,
    title: task?.title ?? "",
    description: task?.description ?? "",
    url: task?.url ?? "https://",
    platform: task?.platform ?? "x",
    rewardNaira: task ? task.reward_kobo / 100 : 100,
    active: task?.active ?? true,
  });
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setF((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_110px]">
        <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Title, e.g. Follow us on Instagram" className={inputCls} aria-label="Task title" />
        <select value={f.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls} aria-label="Platform">
          {PLATFORMS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₦</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={f.rewardNaira}
            onChange={(e) => set("rewardNaira", Number(e.target.value) || 0)}
            className={`${inputCls} pl-7`}
            aria-label="Reward"
          />
        </div>
      </div>
      <input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://instagram.com/…" className={inputCls} aria-label="Link" />
      <input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description (optional)" className={inputCls} aria-label="Description" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
          Live
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveTask(f);
              toast(res.ok ? "Task saved." : res.error, res.ok ? "success" : "error");
              if (res.ok) onDone?.();
            })
          }
          className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} {task ? "Save" : "Add task"}
        </button>
        {task && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${task.title}"?`)) return;
              startTransition(async () => {
                const res = await deleteTask(task.id);
                toast(res.ok ? "Task deleted." : res.error, res.ok ? "success" : "error");
              });
            }}
            className="ml-auto flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-no hover:bg-no/10"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

/** Admin: streak reward ladder + social tasks. */
export function RewardsPanel({
  rewardsKobo,
  tasks,
  claimsToday,
  paidWeekKobo,
}: {
  rewardsKobo: number[];
  tasks: AdminTask[];
  claimsToday: number;
  paidWeekKobo: number;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      <StreakEditor rewardsKobo={rewardsKobo} claimsToday={claimsToday} paidWeekKobo={paidWeekKobo} />
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-white">Social tasks</p>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-xl bg-brand/15 px-3 py-1.5 text-xs font-bold text-brand">
              <Plus className="size-3.5" /> New task
            </button>
          )}
        </div>
        {adding && (
          <div className="rounded-xl border border-brand/30 bg-bg p-3">
            <TaskEditor onDone={() => setAdding(false)} />
          </div>
        )}
        {tasks.length === 0 && !adding && <p className="text-sm text-muted">No tasks yet.</p>}
        {tasks.map((t) => (
          <details key={t.id} className="group rounded-xl border border-line bg-bg">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{t.title}</span>
                <span className="text-[11px] text-muted">
                  {formatNaira(t.reward_kobo)} · {t.claims} claimed · {t.active ? "Live" : "Hidden"}
                </span>
              </span>
              <span className="text-xs text-muted group-open:hidden">Edit</span>
            </summary>
            <div className="border-t border-line p-3">
              <TaskEditor task={t} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
