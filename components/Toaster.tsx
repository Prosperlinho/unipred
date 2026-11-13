"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useUI } from "@/context/UIContext";

const TONES = {
  success: { cls: "border-yes/30 text-yes", Icon: CheckCircle2 },
  error: { cls: "border-no/30 text-no", Icon: XCircle },
  info: { cls: "border-brand/30 text-brand", Icon: Info },
} as const;

export function Toaster() {
  const { toasts, dismissToast } = useUI();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { cls, Icon } = TONES[t.tone];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-2 rounded-xl border bg-card-2 px-3 py-2.5 text-left text-sm shadow-xl ${cls}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="text-white">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
