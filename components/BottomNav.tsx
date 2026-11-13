"use client";

import { Briefcase, LayoutGrid, PlusCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/context/UIContext";

export function BottomNav() {
  const pathname = usePathname();
  const { setCreateOpen } = useUI();

  const item = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
      active ? "text-white" : "text-muted"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md">
        <Link href="/" className={item(pathname === "/")}>
          <LayoutGrid className="size-5" />
          Markets
        </Link>
        <button type="button" onClick={() => setCreateOpen(true)} className={item(false)}>
          <PlusCircle className="size-5 text-brand" />
          Create
        </button>
        <Link href="/portfolio" className={item(pathname === "/portfolio")}>
          <Briefcase className="size-5" />
          Portfolio
        </Link>
      </div>
    </nav>
  );
}
