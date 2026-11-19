import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { getRequestTime } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";
import { getActiveSchools, getSchools, getSettings } from "@/lib/data";
import { compactNaira, formatDate, formatNaira } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Market, Withdrawal } from "@/lib/types";
import { AccountReviewRow, OpenMarketsBySchool, PendingMarketCard, WithdrawalRow, type ReviewAccount } from "./AdminPanels";
import { PartnerPanel, type Partner } from "./PartnerPanel";
import { ProposerPanel } from "./ProposerPanel";
import { PrizePoolPanel, type PoolWeek } from "./PrizePoolPanel";
import { RoomsPanel, type AdminRoom } from "./RoomsPanel";
import { BannerPanel } from "./BannerPanel";
import type { SponsorBanner as SponsorBannerRow } from "@/lib/types";
import { SchedulePanel, type ScheduleRow } from "./SchedulePanel";
import { DailyChart, TopCategories, type DailyStat } from "./StatsPanel";

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
    admin.from("markets").select("*").eq("status", "open").is("room_id", null).order("closes_at", { ascending: true }),
    admin.from("withdrawals").select("*").in("status", ["pending", "processing"]).order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("id, username, full_name, is_banned, ban_reason, flagged_reason, wallets(balance_kobo)")
      .or("is_banned.eq.true,flagged_reason.not.is.null")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("transfers").select("id, from_user, to_user, amount_kobo, note, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const [settings, { data: partnerData }, { data: proposerData }, { data: statsData }, { data: scheduleData }, activeSchools] = await Promise.all([
    getSettings(),
    admin.rpc("partner_stats"),
    admin.from("profiles").select("username").eq("can_propose", true).order("username"),
    admin.rpc("admin_stats"),
    admin.from("market_schedules").select("*").order("created_at"),
    getActiveSchools(),
  ]);
  const stats = statsData as {
    users_total: number;
    users_7d: number;
    bettors_7d: number;
    live_markets: number;
    awaiting_result: number;
    volume_7d: number;
    deposits_7d: number;
    withdrawals_7d: number;
    fees_total: number;
    fees_7d: number;
    invite_bonuses_total: number;
    wallets_total: number;
    daily: DailyStat[];
    top_categories: Array<{ category: string; markets: number; volume: number }>;
  } | null;
  const proposers = ((proposerData ?? []) as Array<{ username: string }>).map((p) => p.username);
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

  const { data: bannerData } = await admin.from("sponsor_banners").select("*").order("created_at", { ascending: false }).limit(30);
  const banners = (bannerData ?? []) as SponsorBannerRow[];

  // ---- Community rooms (newest first) ----
  const { data: roomData } = await admin
    .from("rooms")
    .select("id, name, is_public, suspended, owner_id, profiles!rooms_owner_id_fkey(username), room_members(count)")
    .order("created_at", { ascending: false })
    .limit(50);
  const adminRooms: AdminRoom[] = ((roomData ?? []) as unknown as Array<{
    id: string;
    name: string;
    is_public: boolean;
    suspended: boolean;
    profiles: { username: string } | null;
    room_members: Array<{ count: number }>;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    host: r.profiles?.username ?? "member",
    isPublic: r.is_public,
    suspended: r.suspended,
    members: r.room_members?.[0]?.count ?? 0,
  }));

  // ---- Weekly prize pool: last week (to pay), this week (running), next week (to plan) ----
  const weekDates = await Promise.all(
    [1, 0, -1].map(async (n) => {
      const { data } = await admin.rpc("week_start_date", { p_weeks_ago: n });
      return typeof data === "string" ? data : "";
    }),
  );
  const { data: poolRows } = await admin.from("weekly_prizes").select("*").in("week_start", weekDates.filter(Boolean));
  const poolWeeks: PoolWeek[] = await Promise.all(
    weekDates.filter(Boolean).map(async (d, i) => {
      const row = ((poolRows ?? []) as Array<{ week_start: string; pool_kobo: number; status: "open" | "paid" }>).find((r) => r.week_start === d);
      let standings: PoolWeek["standings"] = [];
      if (row?.status === "paid") {
        const { data: paid } = await admin
          .from("weekly_prize_payouts")
          .select("rank, amount_kobo, profit_kobo, profiles(username)")
          .eq("week_start", d)
          .order("rank");
        standings = ((paid ?? []) as unknown as Array<{ rank: number; amount_kobo: number; profit_kobo: number; profiles: { username: string } | null }>).map((p) => ({
          rank: p.rank,
          username: p.profiles?.username ?? "member",
          profitKobo: Number(p.profit_kobo),
          markets: null,
          prizeKobo: Number(p.amount_kobo),
        }));
      } else if (i < 2) {
        const { data: st } = await admin.rpc("prize_standings", { p_week: d });
        standings = ((st ?? []) as Array<{ rank: number; username: string; profit_kobo: number; markets: number; prize_kobo: number }>).map((r) => ({
          rank: r.rank,
          username: r.username,
          profitKobo: Number(r.profit_kobo),
          markets: r.markets,
          prizeKobo: Number(r.prize_kobo),
        }));
      }
      const start = new Date(`${d}T00:00:00+01:00`).getTime();
      const label = `${["Last week", "This week", "Next week"][i]} · from ${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      return {
        weekStart: d,
        label,
        poolKobo: Number(row?.pool_kobo ?? 0),
        status: (row?.status ?? "none") as PoolWeek["status"],
        ended: start + 7 * 86_400_000 <= getRequestTime(),
        standings,
      };
    }),
  );
  const needsResult = open.filter((m) => new Date(m.closes_at).getTime() <= now).length;

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin</h1>
      <p className="mb-6 text-sm text-muted">
        {pending.length} proposals to review · {needsResult} closed markets need a result · {withdrawals.length} withdrawals ·{" "}
        {review.length} accounts to review
      </p>

      {stats && (
        <section className="mb-8 space-y-3" aria-label="Platform numbers">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Members", value: stats.users_total.toLocaleString("en-NG"), sub: `+${stats.users_7d} this week` },
              { label: "Bettors (7d)", value: stats.bettors_7d.toLocaleString("en-NG"), sub: `${stats.live_markets} live markets` },
              { label: "Money bet (7d)", value: compactNaira(stats.volume_7d), sub: `${stats.awaiting_result} awaiting result` },
              { label: "UniPred fees", value: compactNaira(stats.fees_total), sub: `${compactNaira(stats.fees_7d)} this week` },
              { label: "Deposits (7d)", value: compactNaira(stats.deposits_7d), sub: `${compactNaira(stats.withdrawals_7d)} withdrawn` },
              { label: "In wallets", value: compactNaira(stats.wallets_total), sub: `${compactNaira(stats.invite_bonuses_total)} invite bonuses paid` },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border border-line bg-card p-3">
                <p className="text-[11px] font-medium text-muted">{t.label}</p>
                <p className="mt-0.5 text-xl font-extrabold tabular-nums text-white">{t.value}</p>
                <p className="text-[11px] text-muted">{t.sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
            <DailyChart daily={stats.daily ?? []} />
            <TopCategories rows={stats.top_categories ?? []} />
          </div>
        </section>
      )}

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
            Sponsor banners
            <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{banners.length}</span>
          </h2>
          <BannerPanel banners={banners} />
        </section>

        <Section title="Community rooms" count={adminRooms.length} empty="No rooms yet.">
          <RoomsPanel rooms={adminRooms} />
        </Section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">Weekly prize pool</h2>
          <p className="text-xs text-muted">
            Top 5 by profit win 40% / 25% / 15% / 12% / 8%. Only markets with 3+ bettors count, and winners need 5+ of
            them in the week. Pay after the week ends (Sunday night, Lagos time).
          </p>
          <PrizePoolPanel weeks={poolWeeks} />
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            Repeating markets
            <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{(scheduleData ?? []).length}</span>
          </h2>
          <SchedulePanel
            schools={activeSchools.map((sc) => ({ id: sc.id, short_name: sc.short_name }))}
            schedules={((scheduleData ?? []) as Array<Omit<ScheduleRow, "school"> & { school_id: string }>).map((sc) => ({
              ...sc,
              school: schoolOf[sc.school_id] ?? sc.school_id,
            }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            Who can propose markets
            <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{proposers.length}</span>
          </h2>
          <ProposerPanel proposers={proposers} />
        </section>

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
          <OpenMarketsBySchool markets={open} schoolOf={schoolOf} now={now} />
        </Section>
      </div>
    </Container>
  );
}
