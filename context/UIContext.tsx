"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Outcome, TradeMode } from "@/lib/types";

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface DrawerTarget {
  marketId: string;
  side: Outcome;
  mode: TradeMode;
  tab: "trade" | "banter" | "rules";
}

interface UIContextValue {
  drawer: DrawerTarget | null;
  openMarket: (marketId: string, opts?: Partial<Omit<DrawerTarget, "marketId">>) => void;
  closeMarket: () => void;
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  toasts: Toast[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const openMarket = useCallback<UIContextValue["openMarket"]>((marketId, opts) => {
    setDrawer({
      marketId,
      side: opts?.side ?? "YES",
      mode: opts?.mode ?? "buy",
      tab: opts?.tab ?? "trade",
    });
  }, []);

  const closeMarket = useCallback(() => setDrawer(null), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<UIContextValue["toast"]>(
    (message, tone = "success") => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismissToast(id), 3200);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ drawer, openMarket, closeMarket, createOpen, setCreateOpen, toasts, toast, dismissToast }),
    [drawer, openMarket, closeMarket, createOpen, toasts, toast, dismissToast],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}
