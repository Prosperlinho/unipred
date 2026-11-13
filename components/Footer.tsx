"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { STARTING_BALANCE } from "@/lib/mock-data";

export function Footer() {
  const { resetDemo } = useMarkets();
  const { toast, closeMarket, setCreateOpen } = useUI();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const onReset = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    closeMarket();
    setCreateOpen(false);
    resetDemo();
    setArmed(false);
    toast(`Demo data restored. Balance reset to ${STARTING_BALANCE.toLocaleString()} CP.`, "info");
  };

  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row">
        <p className="text-center sm:text-left">
          CampusPredict demo · Play-money Campus Points only. Data is saved in this browser.
        </p>
        <button
          type="button"
          onClick={onReset}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition ${
            armed ? "border-no bg-no/15 text-no" : "border-line text-muted hover:text-white"
          }`}
        >
          <RotateCcw className="size-3.5" />
          {armed ? "Tap again to confirm reset" : "Reset Demo Data"}
        </button>
      </div>
    </footer>
  );
}
