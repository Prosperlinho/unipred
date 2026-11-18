"use client";

import { Bell, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatNaira, initials } from "@/lib/format";
import { GuideButton, type GuideInfo } from "./Guide";
import { LogoTile } from "./Logo";

interface Props {
  guide: GuideInfo;
  viewer: { username: string; balanceKobo: number; isAdmin: boolean; canPropose: boolean; unread: number } | null;
}

export function Header({ viewer, guide }: Props) {
  const pathname = usePathname();
  const nav = [
    { href: "/markets", label: "Markets" },
    { href: "/leaderboard", label: "Leaderboard" },
    ...(viewer ? [{ href: "/portfolio", label: "Portfolio" }, { href: "/wallet", label: "Wallet" }] : []),
    ...(viewer?.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 transform-gpu border-b border-line bg-bg md:bg-bg/85 md:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-extrabold tracking-tight text-white">
          <LogoTile className="size-8 shrink-0 ring-1 ring-white/10 [border-radius:9px]" />
          <span className="hidden text-[17px] min-[380px]:inline">
            <span className="text-brand">Uni</span>
            <span className="text-cream">Pred</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-tour={n.href === "/" ? undefined : n.href.slice(1)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname === n.href ? "bg-card text-white" : "text-muted hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <GuideButton info={guide} className={viewer ? "hidden sm:flex" : "flex"} />
          {viewer && (
            <Link
              href="/notifications"
              className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand/50 hover:text-brand"
              aria-label={viewer.unread ? `Notifications, ${viewer.unread} new` : "Notifications"}
            >
              <Bell className="size-[17px]" />
              {viewer.unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-black">
                  {viewer.unread > 9 ? "9+" : viewer.unread}
                </span>
              )}
            </Link>
          )}
          {viewer ? (
            <>
              <Link
                href="/wallet"
                data-tour="wallet"
                className="flex min-w-0 items-center gap-1.5 rounded-xl border border-line bg-card px-2 py-1.5 text-sm sm:px-2.5"
                aria-label="Wallet balance"
              >
                <Wallet className="hidden size-4 shrink-0 text-amber-300 min-[375px]:block" />
                <span className="font-bold tabular-nums text-white">{formatNaira(viewer.balanceKobo)}</span>
              </Link>
              {viewer.canPropose && (
              <Link
                href="/propose"
                data-tour="propose"
                className="flex items-center gap-1 rounded-xl bg-brand px-2 py-1.5 text-sm font-bold text-black transition hover:brightness-110 sm:px-3"
                aria-label="Propose a market"
              >
                <Plus className="size-4" strokeWidth={3} />
                <span className="hidden sm:inline">Propose</span>
              </Link>
              )}
              <Link
                href="/profile"
                data-tour="profile"
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
