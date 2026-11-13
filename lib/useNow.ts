"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Current timestamp, refreshed every `intervalMs`.
 * Snapshots are bucketed so React sees a stable value between ticks,
 * and the server snapshot is 0 so prerendering never reads the clock.
 */
export function useNow(intervalMs = 30_000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, Math.min(intervalMs, 5_000));
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getServerSnapshot(): number {
  return 0;
}
