"use client";

import { Briefcase, Flame, LayoutGrid, LogIn, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const items = loggedIn
    ? [
        { href: "/", label: "Home", Icon: Flame },
        { href: "/markets", label: "Markets", Icon: LayoutGrid },
        { href: "/portfolio", label: "Portfolio", Icon: Briefcase },
        { href: "/leaderboard", label: "Leaders", Icon: Trophy },
        { href: "/wallet", label: "Wallet", Icon: Wallet },
      ]
    : [
        { href: "/", label: "Home", Icon: Flame },
        { href: "/markets", label: "Markets", Icon: LayoutGrid },
        { href: "/leaderboard", label: "Leaders", Icon: Trophy },
        { href: "/login", label: "Log in", Icon: LogIn },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 transform-gpu border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-tour={href === "/" || href === "/login" ? undefined : href.slice(1)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-white" : "text-muted"
              }`}
            >
              <Icon className={`size-5 ${href === "/propose" ? "text-brand" : ""}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
