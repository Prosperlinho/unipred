"use client";

import { Briefcase, Gift, LayoutGrid, Loader2, PlusCircle, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { finishOnboarding } from "@/app/actions/settings";

interface Stop {
  href: string;
  title: string;
  text: string;
  Icon: LucideIcon;
  tone: string;
}

const STOPS: Stop[] = [
  { href: "/#markets", title: "Markets", text: "Find your university and pick YES or NO on what happens next.", Icon: LayoutGrid, tone: "text-brand" },
  { href: "/wallet", title: "Wallet", text: "Fund in naira, and withdraw to your own bank account.", Icon: Wallet, tone: "text-amber-300" },
  { href: "/propose", title: "Propose", text: "Turn campus gist into a market. Clear ones go live instantly.", Icon: PlusCircle, tone: "text-yes" },
  { href: "/portfolio", title: "Portfolio", text: "Track your open bets and wins, and share your result cards.", Icon: Briefcase, tone: "text-sky-300" },
  { href: "/profile", title: "Invite & earn", text: "Share your invite link and earn from your friends' bets.", Icon: Gift, tone: "text-pink-300" },
];

/** One-time "where is everything" popup for brand-new accounts. */
export function WelcomeGuide({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const finish = (href?: string) => {
    startTransition(async () => {
      await finishOnboarding();
      setOpen(false);
      if (href) router.push(href);
      else router.refresh();
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-gold" />
          <h2 id="welcome-title" className="font-serif text-2xl text-white">
            Welcome, @{username}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted">Here&apos;s where everything lives. Tap any stop to go straight there.</p>

        <div className="mt-4 grid gap-2">
          {STOPS.map(({ href, title, text, Icon, tone }) => (
            <button
              key={href}
              type="button"
              disabled={pending}
              onClick={() => finish(href)}
              className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-left transition hover:border-white/20 hover:bg-card-2 disabled:opacity-60"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg ${tone}`}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{title}</span>
                <span className="text-xs text-muted">{text}</span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => finish()}
          disabled={pending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Got it, let&apos;s go
        </button>
      </div>
    </div>
  );
}
