"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Current timestamp, refreshed every `intervalMs`.
 * `serverNow` (passed down from a Server Component) is used for the server
 * render and hydration so both produce identical markup.
 */
export function useNow(serverNow: number, intervalMs = 30_000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, Math.min(intervalMs, 5_000));
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]);
  const getServerSnapshot = useCallback(() => serverNow, [serverNow]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
