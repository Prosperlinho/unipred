import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { getRequestTime } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";
import { getSchools, getSettings } from "@/lib/data";
import { formatDate, formatNaira } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Market, Withdrawal } from "@/lib/types";
import { AccountReviewRow, OpenMarketRow, PendingMarketCard, WithdrawalRow, type ReviewAccount } from "./AdminPanels";
import { PartnerPanel, type Partner } from "./PartnerPanel";

export const metadata: Metadata = { title: "Admin · UniPred" };

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

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const [schools, { data: pendingData }, { data: openData }, { data: wData }, { data: reviewData }, { data: transferData }] = await Promise.all([
    getSchools(),
    admin.from("markets").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    admin.from("markets").select("*").eq("status", "open").order("closes_at", { ascending: true }),
    admin.from("withdrawals").select("*").in("status", ["pending", "processing"]).order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("id, username, full_name, is_banned, ban_reason, flagged_reason, wallets(balance_kobo)")
      .or("is_banned.eq.true,flagged_reason.not.is.null")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("transfers").select("id, from_user, to_user, amount_kobo, note, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const [settings, { data: partnerData }] = await Promise.all([getSettings(), admin.rpc("partner_stats")]);
  const partners: Partner[] = ((partnerData ?? []) as Array<{ username: string; rate_bps: number; joined: number; active: number }>).map((p) => ({
    username: p.username,
    ratePct: p.rate_bps / 100,
    joined: p.joined,
    active: p.active,
  }));
  const transfers = (transferData ?? []) as Array<{ id: string; from_user: string; to_user: string; amount_kobo: number; note: string | null; created_at: string }>;
  const transferUserIds = [...new Set(transfers.flatMap((t) => [t.from_user, t.to_user]))];
  const { data: transferUsers } = transferUserIds.length
    ? await admin.from("profiles").select("id, username").in("id", transferUserIds)
    : { data: [] as Array<{ id: string; username: string }> };
  const transferName = new Map((transferUsers ?? []).map((u) => [u.id, u.username]));
  const review: ReviewAccount[] = ((reviewData ?? []) as Array<Omit<ReviewAccount, "balance_kobo"> & { wallets: { balance_kobo: number } | { balance_kobo: number }[] | null }>).map((r) => ({
    ...r,
    balance_kobo: Array.isArray(r.wallets) ? (r.wallets[0]?.balance_kobo ?? 0) : (r.wallets?.balance_kobo ?? 0),
  }));
  const pending = (pendingData ?? []) as Market[];
  const open = (openData ?? []) as Market[];
  const withdrawals = (wData ?? []) as Withdrawal[];

  const userIds = [...new Set([...pending.map((m) => m.created_by), ...withdrawals.map((w) => w.user_id)].filter(Boolean))] as string[];
  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as Array<{ id: string; username: string }> };
  const nameOf = new Map((users ?? []).map((u) => [u.id, u.username]));
  const schoolOf = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const now = getRequestTime();
  const needsResult = open.filter((m) => new Date(m.closes_at).getTime() <= now).length;

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin</h1>
      <p className="mb-6 text-sm text-muted">
        {pending.length} proposals to review · {needsResult} closed markets need a result · {withdrawals.length} withdrawals ·{" "}
        {review.length} accounts to review
      </p>

      <div className="space-y-8">
        <Section title="Proposals to review" count={pending.length} empty="No proposals waiting.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pending.map((m) => (
              <PendingMarketCard
                key={m.id}
                market={m}
                proposer={nameOf.get(m.created_by ?? "") ?? "unknown"}
                school={schoolOf[m.school_id] ?? m.school_id}
              />
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

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            Partner invite rates
            <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{partners.length}</span>
          </h2>
          <PartnerPanel partners={partners} standardPct={settings.referral_share_bps / 100} />
        </section>

        <Section title="Recent member transfers" count={transfers.length} empty="No member transfers yet.">
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-white">
                  @{transferName.get(t.from_user) ?? "?"} → @{transferName.get(t.to_user) ?? "?"}
                  {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold text-white">{formatNaira(t.amount_kobo)}</span>
                  <span className="text-[11px] text-muted">{formatDate(t.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Live markets (resolve or cancel)" count={open.length} empty="No live markets.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {open.map((m) => (
              <OpenMarketRow key={m.id} market={m} school={schoolOf[m.school_id] ?? m.school_id} now={now} />
            ))}
          </div>
        </Section>
      </div>
    </Container>
  );
}
