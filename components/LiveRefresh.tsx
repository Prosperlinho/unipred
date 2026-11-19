"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/**
 * Keeps server-rendered market data fresh without reloading the page:
 * re-fetches every `intervalMs` while the tab is visible (and right away when
 * the user comes back to the tab). Inputs and other on-screen state are kept.
 */
export function useLiveRefresh(intervalMs = 20_000) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const lastRun = useRef(0);

  const refresh = useCallback(() => {
    lastRun.current = Date.now();
    startTransition(() => {
      router.refresh();
      setUpdatedAt(Date.now());
    });
  }, [router]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current >= intervalMs - 500) refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > 4_000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, refresh]);

  return { refresh, pending, updatedAt };
}

/** Invisible auto-refresher for pages without a refresh button. */
export function AutoRefresh({ intervalMs }: { intervalMs?: number }) {
  useLiveRefresh(intervalMs);
  return null;
}

/** "● Live" indicator with a manual refresh button. */
export function LiveBadge({ intervalMs }: { intervalMs?: number }) {
  const { refresh, pending } = useLiveRefresh(intervalMs);
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2 py-1 text-[11px] font-semibold text-muted transition hover:text-white disabled:opacity-70"
      aria-label="Refresh market data"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-yes opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-yes" />
      </span>
      Live
      <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
