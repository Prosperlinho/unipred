"use client";

import { Coins, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { formatCP } from "@/lib/format";

const NAV = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Header() {
  const { hydrated, balance } = useMarkets();
  const { setCreateOpen } = useUI();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-extrabold tracking-tight text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-black">
            <TrendingUp className="size-4" strokeWidth={3} />
          </span>
          <span className="hidden text-[17px] min-[380px]:inline">
            Campus<span className="text-brand">Predict</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname === n.href ? "bg-card text-white" : "text-muted hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-1.5 text-sm"
            aria-label="Your balance"
          >
            <Coins className="size-4 text-amber-300" />
            <span className="font-bold tabular-nums text-white">{hydrated ? formatCP(balance) : "..."}</span>
            <span className="text-xs text-muted">CP</span>
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-sm font-bold text-black transition hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="size-4" strokeWidth={3} />
            <span className="hidden sm:inline">Create Market</span>
            <span className="sm:hidden">Create</span>
          </button>
        </div>
      </div>
    </header>
  );
}
