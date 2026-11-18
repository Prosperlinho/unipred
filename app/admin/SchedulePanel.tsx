"use client";

import { CalendarClock, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createSchedule, deleteSchedule, setScheduleActive, type ScheduleInput } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { CATEGORIES } from "@/lib/types";

export interface ScheduleRow {
  id: string;
  question: string;
  category: string;
  cadence: "daily" | "weekly";
  weekday: number | null;
  run_hour: number;
  close_after_hours: number;
  next_run_at: string;
  active: boolean;
  school: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

/** Markets that go live automatically every day or week. */
export function SchedulePanel({ schedules, schools }: { schedules: ScheduleRow[]; schools: Array<{ id: string; short_name: string }> }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(schedules.length === 0);
  const [form, setForm] = useState<ScheduleInput>({
    schoolId: schools[0]?.id ?? "",
    category: CATEGORIES[0],
    question: "",
    criteria: "",
    source: "",
    cadence: "daily",
    weekday: 6,
    runHour: 8,
    closeAfterHours: 12,
  });
  const set = <K extends keyof ScheduleInput>(k: K, v: ScheduleInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast(res.error ?? "Something went wrong.", "error");
      else toast(msg);
    });

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      {schedules.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-start gap-3 p-3 text-sm">
              <CalendarClock className={`mt-0.5 size-4 shrink-0 ${s.active ? "text-brand" : "text-muted"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${s.active ? "text-white" : "text-muted line-through"}`}>{s.question}</span>
                <span className="text-xs text-muted">
                  {s.school} · {s.category} · {s.cadence === "daily" ? "Every day" : `Every ${DAYS[s.weekday ?? 0]}`} at {hourLabel(s.run_hour)} ·
                  closes after {s.close_after_hours}h
                  {s.active && ` · next ${new Date(s.next_run_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}`}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => setScheduleActive(s.id, !s.active), s.active ? "Paused." : "Resumed.")}
                className="rounded-lg p-1.5 text-muted hover:text-white"
                aria-label={s.active ? "Pause" : "Resume"}
              >
                {s.active ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm("Delete this repeating market? Markets it already created stay.") && act(() => deleteSchedule(s.id), "Deleted.")}
                className="rounded-lg p-1.5 text-muted hover:text-no"
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
          <Plus className="size-4" /> New repeating market
        </button>
      ) : (
        <div className="space-y-2">
          <input
            value={form.question}
            onChange={(e) => set("question", e.target.value)}
            placeholder="Question, e.g. Will it rain at FUNAI on {date}?"
            aria-label="Question"
            className={inputCls}
          />
          <input
            value={form.criteria}
            onChange={(e) => set("criteria", e.target.value)}
            placeholder="YES happens if… e.g. it rains on campus before 6pm"
            aria-label="YES condition"
            className={inputCls}
          />
          <input
            value={form.source}
            onChange={(e) => set("source", e.target.value)}
            placeholder="Confirmed by… e.g. the UniPred campus reporter"
            aria-label="Source"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {schools.length > 1 && (
              <select value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} className={inputCls} aria-label="University">
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.short_name}
                  </option>
                ))}
              </select>
            )}
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} aria-label="Category">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={form.cadence} onChange={(e) => set("cadence", e.target.value as "daily" | "weekly")} className={inputCls} aria-label="How often">
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>
            {form.cadence === "weekly" && (
              <select value={form.weekday} onChange={(e) => set("weekday", Number(e.target.value))} className={inputCls} aria-label="Day">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <select value={form.runHour} onChange={(e) => set("runHour", Number(e.target.value))} className={inputCls} aria-label="Goes live at">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  Live at {hourLabel(h)}
                </option>
              ))}
            </select>
            <select
              value={form.closeAfterHours}
              onChange={(e) => set("closeAfterHours", Number(e.target.value))}
              className={inputCls}
              aria-label="Closes after"
            >
              {[1, 2, 3, 6, 12, 24, 48, 72, 168].map((h) => (
                <option key={h} value={h}>
                  Closes after {h < 24 ? `${h}h` : `${h / 24}d`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted">Write {"{date}"} in the question to put the day&apos;s date in, e.g. &ldquo;on 21 Nov&rdquo;. Times are Lagos time.</p>
          <div className="flex gap-2">
            {schedules.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-white">
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await createSchedule(form);
                  if (!res.ok) return toast(res.error, "error");
                  toast("Repeating market saved.");
                  setForm((f) => ({ ...f, question: "", criteria: "", source: "" }));
                  setAdding(false);
                })
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Save repeating market
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
