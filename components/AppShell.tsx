import { connection } from "next/server";
import type { ReactNode } from "react";
import { UIProvider } from "@/context/UIContext";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured, isTestMode } from "@/lib/env";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Toaster } from "./Toaster";

export async function AppShell({ children }: { children: ReactNode }) {
  // Every page is personal (balance, session), so always render per request.
  await connection();
  const viewer = await getViewer();

  return (
    <UIProvider>
      <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
        {isTestMode && (
          <div className="bg-amber-400/10 px-4 py-1.5 text-center text-[11px] font-medium text-amber-200">
            Test mode: payments use Paystack test cards. No real money moves.
          </div>
        )}
        <Header
          viewer={
            viewer
              ? { username: viewer.profile.username, balanceKobo: viewer.balanceKobo, isAdmin: viewer.profile.is_admin }
              : null
          }
        />
        <main className="w-full flex-1">
          {isSupabaseConfigured ? (
            children
          ) : (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
              <h1 className="text-xl font-bold text-white">Almost ready</h1>
              <p className="mt-2 text-sm text-muted">
                UniPred needs its Supabase keys. Add <code className="text-brand">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="text-brand">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment (see{" "}
                <code>docs/SETUP.md</code>), then restart.
              </p>
            </div>
          )}
        </main>
        <Footer />
      </div>
      <BottomNav loggedIn={!!viewer} />
      <Toaster />
    </UIProvider>
  );
}
