"use client";

import { GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { School } from "@/lib/types";

interface Props {
  schools: School[];
  selected: string;
  mySchoolId: string | null;
}

const GROUPS: School["ownership"][] = ["Federal", "State", "Private"];

export function SchoolPicker({ schools, selected, mySchoolId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mine = schools.find((s) => s.id === mySchoolId);

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Choose a university</span>
      <GraduationCap className="pointer-events-none absolute left-3 size-4 text-brand-gold" />
      <select
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          startTransition(() => router.push(`/?school=${encodeURIComponent(v)}#markets`, { scroll: false }));
        }}
        className={`w-full appearance-none rounded-xl border border-line bg-card py-2.5 pl-9 pr-8 text-sm font-semibold text-white focus:border-brand focus:outline-none sm:w-auto ${
          pending ? "opacity-60" : ""
        }`}
      >
        <option value="all">All universities</option>
        {mine && <option value={mine.id}>My school: {mine.short_name}</option>}
        {GROUPS.map((g) => (
          <optgroup key={g} label={`${g} universities`}>
            {schools
              .filter((s) => s.ownership === g)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.short_name})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 text-xs text-muted">▾</span>
    </label>
  );
}
