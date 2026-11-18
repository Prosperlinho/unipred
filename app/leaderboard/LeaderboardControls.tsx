"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import type { School } from "@/lib/types";

export type Period = "week" | "last_week" | "all";

const PERIODS: Array<[Period, string]> = [
  ["week", "This week"],
  ["last_week", "Last week"],
  ["all", "All time"],
];

export function LeaderboardControls({
  schools,
  school,
  period,
  mySchoolId,
}: {
  schools: School[];
  school: string;
  period: Period;
  mySchoolId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (next: { school?: string; period?: Period }) => {
    const q = new URLSearchParams();
    const s = next.school ?? school;
    const p = next.period ?? period;
    if (s && s !== "all") q.set("school", s);
    if (p !== "week") q.set("period", p);
    startTransition(() => router.push(`/leaderboard${q.size ? `?${q}` : ""}`, { scroll: false }));
  };

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${pending ? "opacity-60" : ""}`}>
      <div className="flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label="Period">
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => go({ period: p })}
            className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
              period === p ? "bg-brand text-black" : "text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {schools.length > 1 && (
        <div className="w-full sm:w-80">
          <SchoolCombobox
            schools={schools}
            value={school}
            allowAll
            mySchoolId={mySchoolId}
            align="right"
            placeholder="All universities"
            onChange={(v) => go({ school: v })}
          />
        </div>
      )}
    </div>
  );
}
