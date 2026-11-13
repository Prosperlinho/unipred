"use client";

import { Plus, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatNaira, initials } from "@/lib/format";

interface Props {
  viewer: { username: string; balanceKobo: number; isAdmin: boolean } | null;
}

export function Header({ viewer }: Props) {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Markets" },
    ...(viewer ? [{ href: "/portfolio", label: "Portfolio" }, { href: "/wallet", label: "Wallet" }] : []),
    ...(viewer?.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-extrabold tracking-tight text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-black">
            <TrendingUp className="size-4" strokeWidth={3} />
          </span>
          <span className="hidden text-[17px] min-[380px]:inline">
            Uni<span className="text-brand">Pred</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((n) => (
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
          {viewer ? (
            <>
              <Link
                href="/wallet"
                className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-1.5 text-sm"
                aria-label="Wallet balance"
              >
                <Wallet className="size-4 text-amber-300" />
                <span className="font-bold tabular-nums text-white">{formatNaira(viewer.balanceKobo)}</span>
              </Link>
              <Link
                href="/propose"
                className="hidden items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-sm font-bold text-black transition hover:brightness-110 sm:flex"
              >
                <Plus className="size-4" strokeWidth={3} />
                Propose
              </Link>
              <Link
                href="/profile"
                className="flex size-8 items-center justify-center rounded-full bg-card-2 text-[11px] font-bold text-white ring-1 ring-line transition hover:ring-brand"
                aria-label="Your profile"
              >
                {initials(viewer.username)}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white hover:bg-card">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-brand px-3 py-1.5 text-sm font-bold text-black transition hover:brightness-110"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
