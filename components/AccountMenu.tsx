"use client";

import {
  Bell,
  BookOpen,
  Briefcase,
  ChevronDown,
  Flame,
  LogOut,
  Settings,
  Shield,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { formatNaira, initials } from "@/lib/format";

interface Props {
  username: string;
  balanceKobo: number;
  unread: number;
  isAdmin: boolean;
}

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  badge?: number;
}

/** The avatar button opens a grouped account menu: money, rewards, account, help. */
export function AccountMenu({ username, balanceKobo, unread, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close on navigation, outside tap and Escape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups: Array<{ title: string; items: Item[] }> = [
    {
      title: "Money",
      items: [
        { href: "/wallet", label: "Wallet", icon: Wallet, hint: "Deposit, withdraw, send" },
        { href: "/portfolio", label: "Portfolio", icon: Briefcase, hint: "Open bets and results" },
      ],
    },
    {
      title: "Earn",
      items: [{ href: "/tasks", label: "Tasks & Streak", icon: Flame, hint: "Daily rewards and tasks" }],
    },
    {
      title: "Account",
      items: [
        { href: "/profile", label: "Profile & invites", icon: User },
        { href: "/settings", label: "Settings", icon: Settings, hint: "Bank account, interests, privacy" },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: unread },
      ],
    },
    {
      title: "Help",
      items: [
        { href: "/rules", label: "House rules", icon: BookOpen },
        ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
      ],
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-tour="profile"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 ring-1 ring-line transition hover:ring-brand aria-expanded:ring-brand"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-card-2 text-[11px] font-bold text-white">{initials(username)}</span>
        <ChevronDown className={`size-3.5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(19rem,calc(100vw-1.5rem))] origin-top-right animate-pop-in overflow-hidden rounded-2xl border border-line bg-bg shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]"
        >
          <div className="flex items-center gap-3 border-b border-line bg-card p-3.5">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-sm font-extrabold text-brand">{initials(username)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">@{username}</p>
              <p className="text-xs text-muted">
                Balance <span className="font-semibold tabular-nums text-white">{formatNaira(balanceKobo)}</span>
              </p>
            </div>
            <Link href="/wallet" role="menuitem" className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-bold text-black hover:brightness-110">
              Deposit
            </Link>
          </div>

          <nav className="max-h-[min(70dvh,32rem)] overflow-y-auto py-1.5">
            {groups.map((g) => (
              <div key={g.title} className="px-1.5 py-1">
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{g.title}</p>
                {g.items.map((it) => {
                  const active = pathname === it.href;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition ${active ? "bg-card-2" : "hover:bg-card"}`}
                    >
                      <it.icon className={`size-[18px] shrink-0 ${active ? "text-brand" : "text-white/70"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{it.label}</span>
                        {it.hint && <span className="block truncate text-[11px] text-muted">{it.hint}</span>}
                      </span>
                      {!!it.badge && (
                        <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-black">{it.badge > 9 ? "9+" : it.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <form action={signOut} className="border-t border-line p-1.5">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold text-no transition hover:bg-no/10">
              <LogOut className="size-[18px]" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
