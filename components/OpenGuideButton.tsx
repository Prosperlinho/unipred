"use client";

import { ChevronRight, CircleHelp } from "lucide-react";
import { OPEN_GUIDE_EVENT } from "./Guide";

/** Profile-menu row that opens the guide sheet (the header "?" is hidden on small phones). */
export function OpenGuideButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-card-2"
    >
      <CircleHelp className="size-5 text-muted" />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-white">Help & guide</span>
        <span className="text-xs text-muted">How UniPred works, or replay the tour</span>
      </span>
      <ChevronRight className="size-4 text-muted" />
    </button>
  );
}
