import type { Metadata } from "next";
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

function Section({ title, count, children, empty }: { title: string; count: number; children: ReactNode; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        {title}
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{count}</span>
      </h2>
      {count === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

/**
 * Admin home. The urgent queues (proposals, withdrawals, flagged accounts, live markets) load first with
 * light queries; every other panel streams in on its own and can't take the page down if it fails.
 */
/** The urgent queues: proposals, withdrawals, flagged accounts and live markets. */
async function CoreQueues() {
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

      <div className="space-y-8">
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

        <Section title="Live markets (resolve or cancel)" count={open.length} empty="No live markets.">
          <OpenMarketsBySchool markets={open} schoolOf={schoolOf} now={now} />
        </Section>
      </div>
    </>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin</h1>
      <div className="space-y-8">
        <Suspense fallback={<SectionSkeleton title="Platform numbers" tall />}>
          <StatsSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Proposals, withdrawals & accounts" tall />}>
          <CoreQueues />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Weekly prize pool" tall />}>
          <PrizePoolSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Sponsor banners" tall />}>
          <BannersSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Community rooms" />}>
          <RoomsSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Repeating markets" />}>
          <SchedulesSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Who can propose markets" />}>
          <ProposersSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Partner invite rates" />}>
          <PartnersSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Recent member transfers" />}>
          <TransfersSection />
        </Suspense>
      </div>
    </Container>
  );
}
