"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/** Bottom drawer on mobile, centred modal on larger screens. */
export function Sheet({ open, onClose, title, children, wide = false }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 animate-fade-in bg-black/70"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-2xl border border-line bg-bg shadow-2xl sm:animate-pop-in sm:rounded-2xl ${
          wide ? "sm:max-w-xl" : "sm:max-w-md"
        }`}
      >
        <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-2 pl-4 pr-2">
          <h2 className="text-sm font-semibold text-muted">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition hover:bg-card hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
