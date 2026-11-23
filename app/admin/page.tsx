import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Container } from "@/components/Container";
import { requireAdmin } from "@/lib/auth";
import { getSchools } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestTime } from "@/lib/time";
import type { Market, Withdrawal } from "@/lib/types";
import { AccountReviewRow, OpenMarketsBySchool, PendingMarketCard, WithdrawalRow, type ReviewAccount } from "./AdminPanels";
import {
  BannersSection,
  PartnersSection,
  LiquiditySection,
  RewardsSection,
  PrizePoolSection,
  ProposersSection,
  RoomsSection,
  SchedulesSection,
  SectionSkeleton,
  StatsSection,
  TransfersSection,
} from "./sections";

export const metadata: Metadata = { title: "Admin · UniPred" };
// Give slow days some headroom; sections stream in as they finish.
export const maxDuration = 60;

/** A collapsible section: a compact row with the count; tap to expand. Empty sections are a single line. */
function Section({ title, count, children, empty }: { title: string; count: number; children: ReactNode; empty: string }) {
  if (count === 0) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="text-xs text-muted">{empty}</span>
      </div>
    );
  }
  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          {title}
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-black">{count}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-3">{children}</div>
    </details>
  );
}

/**
 * Admin home. The urgent queues (proposals, withdrawals, flagged accounts, live markets) load first with
 * light queries; every other panel streams in on its own and can't take the page down if it fails.
 */
/** The urgent queues: proposals, withdrawals, flagged accounts and live markets. */
async function CoreQueues({ part }: { part: "todo" | "markets" }) {
  const admin = createAdminClient();
  const [schools, pendingRes, openRes, wRes, reviewRes] = await Promise.all([
    getSchools(),
    admin.from("markets").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    admin.from("markets").select("*").eq("status", "open").is("room_id", null).order("closes_at", { ascending: true }),
    admin.from("withdrawals").select("*").in("status", ["pending", "processing"]).order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("id, username, full_name, is_banned, ban_reason, flagged_reason, wallets(balance_kobo)")
      .or("is_banned.eq.true,flagged_reason.not.is.null")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const failed = [pendingRes, openRes, wRes, reviewRes].some((r) => r.error);
  const pending = (pendingRes.data ?? []) as Market[];
  const open = (openRes.data ?? []) as Market[];
  const withdrawals = (wRes.data ?? []) as Withdrawal[];
  const review: ReviewAccount[] = (
    (reviewRes.data ?? []) as Array<Omit<ReviewAccount, "balance_kobo"> & { wallets: { balance_kobo: number } | { balance_kobo: number }[] | null }>
  ).map((r) => ({
    ...r,
    balance_kobo: Array.isArray(r.wallets) ? (r.wallets[0]?.balance_kobo ?? 0) : (r.wallets?.balance_kobo ?? 0),
  }));

  const userIds = [...new Set([...pending.map((m) => m.created_by), ...withdrawals.map((w) => w.user_id)].filter(Boolean))] as string[];
  const { data: users } = userIds.length ? await admin.from("profiles").select("id, username").in("id", userIds) : { data: [] };
  const nameOf = new Map(((users ?? []) as Array<{ id: string; username: string }>).map((u) => [u.id, u.username]));
  const schoolOf = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const now = getRequestTime();
  const needsResult = open.filter((m) => new Date(m.closes_at).getTime() <= now).length;

  return (
    <>
      <p className="mb-6 text-sm text-muted">
        {pending.length} proposals to review · {needsResult} closed markets need a result · {withdrawals.length} withdrawals ·{" "}
        {review.length} accounts to review
      </p>
      {failed && (
        <p className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100">
          Some lists didn&apos;t load (the database is busy). Refresh in a moment.
        </p>
      )}

      <div className="space-y-3">
        {part === "todo" && (
        <>
        <Section title="Proposals to review" count={pending.length} empty="No proposals waiting.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pending.map((m) => (
              <PendingMarketCard key={m.id} market={m} proposer={nameOf.get(m.created_by ?? "") ?? "unknown"} school={schoolOf[m.school_id] ?? m.school_id} />
            ))}
          </div>
        </Section>

        <Section title="Withdrawals" count={withdrawals.length} empty="No withdrawals waiting.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {withdrawals.map((w) => (
              <WithdrawalRow key={w.id} w={w} username={nameOf.get(w.user_id) ?? "unknown"} />
            ))}
          </div>
        </Section>

        <Section title="Flagged & suspended accounts" count={review.length} empty="No accounts need review.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {review.map((a) => (
              <AccountReviewRow key={a.id} a={a} />
            ))}
          </div>
        </Section>

        </>
        )}
        {part === "markets" && (
        <Section title="Live markets (resolve or cancel)" count={open.length} empty="No live markets.">
          <OpenMarketsBySchool markets={open} schoolOf={schoolOf} now={now} />
        </Section>
        )}
      </div>
    </>
  );
}

const TABS = [
  { id: "todo", label: "To do" },
  { id: "overview", label: "Overview" },
  { id: "markets", label: "Markets" },
  { id: "money", label: "Money" },
  { id: "sponsors", label: "Sponsors" },
  { id: "rooms", label: "Rooms" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Small counts for the tab badges (head-only queries, cheap). */
async function waitingCounts() {
  const admin = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [p, w, f, c] = await Promise.all([
    admin.from("markets").select("id", head).eq("status", "pending"),
    admin.from("withdrawals").select("id", head).in("status", ["pending", "processing"]),
    admin.from("profiles").select("id", head).or("is_banned.eq.true,flagged_reason.not.is.null"),
    admin.from("markets").select("id", head).eq("status", "open").is("room_id", null).lte("closes_at", new Date().toISOString()),
  ]);
  return { todo: (p.count ?? 0) + (w.count ?? 0) + (f.count ?? 0), markets: c.count ?? 0 };
}

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "todo";
  const counts = await waitingCounts().catch(() => ({ todo: 0, markets: 0 }));
  const badge: Partial<Record<Tab, number>> = { todo: counts.todo, markets: counts.markets };

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin</h1>

      <nav className="no-scrollbar -mx-4 mb-6 mt-3 flex gap-2 overflow-x-auto px-4" aria-label="Admin sections">
        {TABS.map((t) => {
          const active = t.id === tab;
          const n = badge[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-brand text-black" : "border border-line bg-card text-muted hover:text-white"
              }`}
            >
              {t.label}
              {n > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] font-extrabold ${active ? "bg-black/20 text-black" : "bg-amber-400 text-black"}`}>{n}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-8">
        {tab === "todo" && (
          <Suspense fallback={<SectionSkeleton title="Proposals, withdrawals & accounts" tall />}>
            <CoreQueues part="todo" />
          </Suspense>
        )}

        {tab === "overview" && (
          <Suspense fallback={<SectionSkeleton title="Platform numbers" tall />}>
            <StatsSection />
          </Suspense>
        )}

        {tab === "markets" && (
          <>
            <Suspense fallback={<SectionSkeleton title="Live markets" tall />}>
              <CoreQueues part="markets" />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Repeating markets" />}>
              <SchedulesSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Who can propose markets" />}>
              <ProposersSection />
            </Suspense>
          </>
        )}

        {tab === "money" && (
          <>
            <Suspense fallback={<SectionSkeleton title="Market liquidity" />}>
              <LiquiditySection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Tasks & streak" tall />}>
              <RewardsSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Weekly prize pool" tall />}>
              <PrizePoolSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Partner invite rates" />}>
              <PartnersSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton title="Recent member transfers" />}>
              <TransfersSection />
            </Suspense>
          </>
        )}

        {tab === "sponsors" && (
          <Suspense fallback={<SectionSkeleton title="Sponsor banners" tall />}>
            <BannersSection />
          </Suspense>
        )}

        {tab === "rooms" && (
          <Suspense fallback={<SectionSkeleton title="Community rooms" />}>
            <RoomsSection />
          </Suspense>
        )}
      </div>
    </Container>
  );
}
