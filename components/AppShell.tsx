"use client";

import type { ReactNode } from "react";
import { MarketProvider } from "@/context/MarketContext";
import { UIProvider } from "@/context/UIContext";
import { BottomNav } from "./BottomNav";
import { CreateMarketModal } from "./CreateMarketModal";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MarketDrawer } from "./MarketDrawer";
import { Toaster } from "./Toaster";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MarketProvider>
      <UIProvider>
        <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:py-6">{children}</main>
          <Footer />
        </div>
        <BottomNav />
        <MarketDrawer />
        <CreateMarketModal />
        <Toaster />
      </UIProvider>
    </MarketProvider>
  );
}
