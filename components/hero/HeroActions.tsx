"use client";

import { ArrowRight } from "lucide-react";
import { useUI } from "@/context/UIContext";

export function HeroActions() {
  const { setCreateOpen } = useUI();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <a
        href="#markets"
        className="group flex items-center justify-center gap-3 rounded-full bg-brand-teal px-8 py-4 font-medium text-white transition-colors hover:bg-[#47c4c9]"
      >
        Start Predicting
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
      </a>
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="group flex items-center justify-center gap-3 rounded-full border border-white/40 bg-transparent px-8 py-4 font-medium text-white transition-colors hover:border-white hover:bg-white/5"
      >
        Create a Market
        <ArrowRight className="size-5 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
      </button>
    </div>
  );
}
