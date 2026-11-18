"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { School } from "@/lib/types";
import { SchoolCombobox } from "./SchoolCombobox";

interface Props {
  schools: School[];
  selected: string;
  mySchoolId: string | null;
}

/** University switcher for the market feed. */
export function SchoolPicker({ schools, selected, mySchoolId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={`w-full sm:w-80 ${pending ? "opacity-60" : ""}`}>
      <SchoolCombobox
        schools={schools}
        value={selected}
        allowAll
        mySchoolId={mySchoolId}
        align="right"
        placeholder="All universities"
        onChange={(v) =>
          startTransition(() => router.push(`/markets?school=${encodeURIComponent(v)}`, { scroll: false }))
        }
      />
    </div>
  );
}
