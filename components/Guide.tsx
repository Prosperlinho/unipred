"use client";

import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Gavel,
  Gift,
  HandCoins,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Play,
  PlusCircle,
  Search,
  Send,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { startTour } from "./Tour";

/** Numbers the guide quotes, straight from the live settings. */
export interface GuideInfo {
  feePct: number;
  exitFeePct: number;
  referralPct: number;
  minBet: string;
  minDeposit: string;
  minWithdrawal: string;
  supportEmail: string;
}

interface Topic {
  id: string;
  title: string;
  Icon: LucideIcon;
  tone: string;
  body: ReactNode;
  link?: { href: string; label: string };
  /** Extra words people might search for. */
  keywords: string;
}

function topics(g: GuideInfo): Topic[] {
  return [
    {
      id: "start",
      title: "Getting started",
      Icon: BadgeCheck,
      tone: "text-brand",
      keywords: "sign up signup account confirm email verify rules university school",
      body: (
        <ol className="list-decimal space-y-1 pl-4">
          <li>Sign up with your real full name (it must match your bank account, and can&apos;t be changed later).</li>
          <li>Open the confirmation email we send you and tap the link. Check spam if it&apos;s not in your inbox.</li>
          <li>Read and accept the House Rules.</li>
          <li>Fund your wallet, pick a market, and make your first call.</li>
        </ol>
      ),
      link: { href: "/rules", label: "Read the House Rules" },
    },
    {
      id: "fund",
      title: "Funding your wallet",
      Icon: Wallet,
      tone: "text-amber-300",
      keywords: "deposit fund top up paystack card transfer add money",
      body: (
        <p>
          Go to Wallet → Deposit and pay with card, bank transfer or USSD through Paystack. Minimum deposit is{" "}
          <b>{g.minDeposit}</b>. Only use payment methods in your own name. Your balance updates as soon as Paystack confirms.
        </p>
      ),
      link: { href: "/wallet", label: "Open your wallet" },
    },
    {
      id: "bet",
      title: "How betting works",
      Icon: LayoutGrid,
      tone: "text-yes",
      keywords: "bet stake yes no pool pot odds payout fee how win chance percent",
      body: (
        <>
          <p>
            <b>New markets:</b> odds move with every bet. Your money buys YES or NO shares at the current price, each
            winning share pays ₦100, and once a market is halfway to closing you can cash out at the live price (for a profit or a loss).
          </p>
          <p className="mt-2">
            <b>Older pot markets:</b> every market is a YES/NO question. Your stake goes into the YES pot or the NO pot. When the result is confirmed,
            everyone on the winning side gets <b>their stake back plus a share of the losing pot</b>, in proportion to what
            they put in.
          </p>
          <p className="mt-2">
            UniPred keeps <b>{g.feePct}% of the winnings</b> (never your stake). The payout you see before betting is an
            estimate that moves as others bet. The % on each market is the share of money on YES. Minimum bet is{" "}
            <b>{g.minBet}</b>.
          </p>
        </>
      ),
      link: { href: "/markets", label: "Browse markets" },
    },
    {
      id: "cashout",
      title: "Cashing out early",
      Icon: HandCoins,
      tone: "text-sky-300",
      keywords: "cash out sell exit early take back money",
      body: (
        <p>
          Changed your mind? Before betting closes, open the market, tap <b>Cash out</b> and take back part or all of your
          bet. You get the amount minus a <b>{g.exitFeePct}% exit fee</b>. After closing time, bets stay in until the
          result.
        </p>
      ),
    },
    {
      id: "results",
      title: "Results and refunds",
      Icon: Gavel,
      tone: "text-violet-300",
      keywords: "result resolve resolved winner paid refund cancel cancelled source when",
      body: (
        <ul className="list-disc space-y-1 pl-4">
          <li>Betting stops at the closing time shown on the market.</li>
          <li>A UniPred admin confirms the result using the official source named on the market, then winners are paid straight to their wallet.</li>
          <li>If nobody backed the losing side, winners just get their stake back. If nobody backed the winning side, everyone is refunded.</li>
          <li>Unclear or unfair markets, or ones with no confirmed result within 7 days, are cancelled and fully refunded.</li>
        </ul>
      ),
    },
    {
      id: "withdraw",
      title: "Withdrawing to your bank",
      Icon: Banknote,
      tone: "text-yes",
      keywords: "withdraw withdrawal bank payout cash out money account name",
      body: (
        <p>
          First add your bank account in Settings: it must be in <b>your own name</b>, matching the full name on your
          UniPred account, and can only be linked to one UniPred account. Then go to Wallet → Withdraw (minimum{" "}
          <b>{g.minWithdrawal}</b>). Withdrawals are reviewed, then sent by Paystack.
        </p>
      ),
      link: { href: "/settings#payout", label: "Add your bank account" },
    },
    {
      id: "send",
      title: "Sending money to a friend",
      Icon: Send,
      tone: "text-pink-300",
      keywords: "send transfer username friend p2p",
      body: (
        <p>
          Wallet → Send to a member. Type their username and the amount. You can send once your account is a few days old
          and you&apos;ve placed a few bets, and both of you need a verified bank account in your own name. The exact rules
          and daily limits show in the Wallet. Transfers are instant and final, so check the username.
        </p>
      ),
      link: { href: "/wallet", label: "Send money" },
    },
    {
      id: "invite",
      title: "Invite friends and earn",
      Icon: Gift,
      tone: "text-pink-300",
      keywords: "invite referral refer bonus earn link friends",
      body: (
        <p>
          Share your invite link from your Profile. Once a friend who joined through it is <b>active</b> (at least 5 bets a
          day for 3 days in a row), you earn <b>{g.referralPct}% of UniPred&apos;s fee</b> on their bets whenever a market
          resolves. Your Profile shows each friend&apos;s progress.
        </p>
      ),
      link: { href: "/profile", label: "Get your invite link" },
    },
    {
      id: "propose",
      title: "Proposing a market",
      Icon: PlusCircle,
      tone: "text-brand",
      keywords: "propose create new market question add",
      body: (
        <p>
          Proposing is by invitation: UniPred approves who can create markets. If you have access, tap <b>+</b> (Propose)
          at the top. Ask a YES/NO question, say exactly what must happen for YES, name the official
          source that will confirm it, and choose a closing time. Clear proposals go live straight away. Markets about
          private individuals, or things a bettor can secretly control, aren&apos;t allowed.
        </p>
      ),
      link: { href: "/propose", label: "Propose a market" },
    },
    {
      id: "rooms",
      title: "Community rooms",
      Icon: Users,
      tone: "text-brand",
      keywords: "room rooms community group friends private invite host",
      body: (
        <p>
          Anyone can start a room for their friends, hostel or department. Public rooms are open to all; private ones need
          the invite link. The host drops YES/NO questions and decides the results, so only stake in rooms whose host you
          trust. Room questions don&apos;t count for the leaderboard or the prize pool.
        </p>
      ),
      link: { href: "/rooms", label: "Open rooms" },
    },
    {
      id: "leaderboard",
      title: "Leaderboard",
      Icon: Trophy,
      tone: "text-amber-300",
      keywords: "leaderboard rank top ranking best",
      body: (
        <p>
          See the top predictors this week, last week and of all time, ranked by profit on resolved markets. When there&apos;s
          a weekly prize pool, the top 5 share it (40/25/15/12/8%): play at least 5 markets with 3+ bettors that week to
          qualify. Prizes land in your wallet after Sunday.
        </p>
      ),
      link: { href: "/leaderboard", label: "See the leaderboard" },
    },
    {
      id: "cards",
      title: "Sharing your win (or L) cards",
      Icon: ImageIcon,
      tone: "text-sky-300",
      keywords: "card share download image win flex portfolio",
      body: (
        <p>
          On any market you bet on, scroll to <b>Your bets</b> and tap the card button to download or share an image of your
          bet. Bet on both sides? You get a separate card for each side. Shared links carry your invite code.
        </p>
      ),
      link: { href: "/portfolio", label: "Open your portfolio" },
    },
    {
      id: "safety",
      title: "Staying safe",
      Icon: ShieldCheck,
      tone: "text-no",
      keywords: "safe security scam fraud password one account 18 responsible suspended",
      body: (
        <ul className="list-disc space-y-1 pl-4">
          <li>You must be 18+. One person, one account. Multiple accounts or other people&apos;s bank accounts get you suspended.</li>
          <li>UniPred staff will never ask for your password or OTP.</li>
          <li>Never send money to anyone promising to &ldquo;double&rdquo; it or sell you a sure result. That&apos;s a scam.</li>
          <li>Only stake what you can afford to lose. Never use school fees or borrowed money.</li>
        </ul>
      ),
    },
    {
      id: "help",
      title: "Getting help",
      Icon: CircleHelp,
      tone: "text-brand",
      keywords: "help support contact email problem complaint",
      body: (
        <p>
          Email{" "}
          <a href={`mailto:${g.supportEmail}`} className="text-brand underline">
            {g.supportEmail}
          </a>{" "}
          with your username and what happened. Complaints about a result must be raised within 7 days of it resolving.
        </p>
      ),
      link: { href: "/terms", label: "Read the Terms" },
    },
  ];
}

/** The directory itself: searchable topics that expand in place. */
export function GuideDirectory({ info, onNavigate }: { info: GuideInfo; onNavigate?: (href: string) => void }) {
  const all = useMemo(() => topics(info), [info]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("start");
  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter((t) => `${t.title} ${t.keywords}`.toLowerCase().includes(q))
    : all;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: deposit, withdraw, cash out…"
          aria-label="Search the guide"
          className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-brand/50 focus:outline-none"
        />
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing found. Try another word.</p>}
      <ul className="space-y-2">
        {shown.map((t) => {
          const isOpen = q ? true : open === t.id;
          return (
            <li key={t.id} className="overflow-hidden rounded-xl border border-line bg-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : t.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-card-2"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg ${t.tone}`}>
                  <t.Icon className="size-[18px]" />
                </span>
                <span className="flex-1 text-sm font-semibold text-white">{t.title}</span>
                <ChevronDown className={`size-4 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-line px-3 pb-3 pt-2.5 text-[13px] leading-relaxed text-white/80">
                  {t.body}
                  {t.link && (
                    <Link
                      href={t.link.href}
                      onClick={() => onNavigate?.(t.link!.href)}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      {t.link.label} <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bottom sheet (phones) / dialog (desktop) holding the directory. */
export function GuideSheet({
  info,
  title,
  subtitle,
  onClose,
  closeLabel,
  closing = false,
}: {
  info: GuideInfo;
  title: string;
  subtitle: string;
  onClose: () => void;
  closeLabel?: string;
  closing?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/75" />
      <div className="relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-2xl border border-line bg-bg sm:max-w-lg sm:animate-pop-in sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 id="guide-title" className="flex items-center gap-2 text-lg font-extrabold text-white">
              <BookOpen className="size-5 text-brand" /> {title}
            </h2>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-card hover:text-white" aria-label="Close guide">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              startTour();
            }}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-brand/40 bg-brand/10 p-3 text-left transition hover:bg-brand/15"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-black">
              <Play className="size-4 fill-black" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-white">Take the tour</span>
              <span className="text-xs text-muted">We&apos;ll point out each part of the app.</span>
            </span>
            <ArrowRight className="size-4 text-brand" />
          </button>
          <GuideDirectory info={info} onNavigate={onClose} />
        </div>
        {closeLabel && (
          <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              disabled={closing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {closing && <Loader2 className="size-4 animate-spin" />}
              {closeLabel}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** "?" button in the header that opens the guide any time. */
export const OPEN_GUIDE_EVENT = "unipred:open-guide";

export function GuideButton({ info, className = "flex" }: { info: GuideInfo; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="guide"
        className={`${className} size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand/50 hover:text-brand`}
        aria-label="Open the UniPred guide"
        title="Guide"
      >
        <CircleHelp className="size-[18px]" />
      </button>
      {open && <GuideSheet info={info} title="UniPred guide" subtitle="Everything you need to know, in one place." onClose={() => setOpen(false)} />}
    </>
  );
}
