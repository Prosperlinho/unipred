import type { ReactNode } from "react";
import { getActiveSchools, getSchools, getSettings } from "@/lib/data";
import { compactNaira, formatDate, formatNaira } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestTime } from "@/lib/time";
import { GENERAL_SCHOOL_ID, type SponsorBanner as SponsorBannerRow } from "@/lib/types";
import { BannerPanel } from "./BannerPanel";
import { LiquidityPanel } from "./LiquidityPanel";
import { PartnerPanel, type Partner } from "./PartnerPanel";
import { PrizePoolPanel, type PoolWeek } from "./PrizePoolPanel";
import { ProposerPanel } from "./ProposerPanel";
import { RewardsPanel, type AdminTask } from "./RewardsPanel";
import { RoomsPanel, type AdminRoom } from "./RoomsPanel";
import { SchedulePanel, type ScheduleRow } from "./SchedulePanel";
import { DailyChart, TopCategories, type DailyStat } from "./StatsPanel";

/**
 * Each admin section loads its own data inside a <Suspense> boundary, so a slow or failing
 * query only affects that section: the rest of the admin page still works.
 */

export function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
      {title}
      {count !== undefined && <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{count}</span>}
    </h2>
  );
}

export function SectionSkeleton({ title, tall = false }: { title: string; tall?: boolean }) {
  return (
    <section className="space-y-3" aria-busy="true">
      <SectionHeading title={title} />
      <div className={`animate-pulse rounded-2xl border border-line bg-card ${tall ? "h-56" : "h-24"}`} />
    </section>
  );
}

function SectionError({ title }: { title: string }) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} />
      <p className="rounded-2xl border border-dashed border-no/30 p-4 text-sm text-muted">
        Couldn&apos;t load this part right now. Refresh the page to try again; everything else still works.
      </p>
    </section>
  );
}

/** Runs a section's loader; on any error (or timeout) shows a small notice instead of crashing the page. */
async function guarded(title: string, load: () => Promise<ReactNode>, timeoutMs = 20_000): Promise<ReactNode> {
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
  } catch (e) {
    console.error(`[admin] ${title} failed:`, e instanceof Error ? e.message : e);
    return <SectionError title={title} />;
  }
}

/** Supabase calls resolve with { error } instead of throwing; turn that into a throw. */
function must<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------------------------------------------------------------------------------------------

export async function StatsSection() {
  return guarded("Platform numbers", async () => {
    const stats = must(await createAdminClient().rpc("admin_stats")) as {
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
    if (!stats) return null;
    return (
      <section className="space-y-3" aria-label="Platform numbers">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Members", value: stats.users_total.toLocaleString("en-NG"), sub: `+${stats.users_7d} this week` },
            { label: "Traders (7d)", value: stats.bettors_7d.toLocaleString("en-NG"), sub: `${stats.live_markets} live markets` },
            { label: "Money traded (7d)", value: compactNaira(stats.volume_7d), sub: `${stats.awaiting_result} awaiting result` },
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
    );
  });
}

export async function BannersSection() {
  return guarded("Sponsor banners", async () => {
    const banners = (must(await createAdminClient().from("sponsor_banners").select("*").order("created_at", { ascending: false }).limit(30)) ??
      []) as SponsorBannerRow[];
    return (
      <section className="space-y-3">
        <SectionHeading title="Sponsor banners" count={banners.length} />
        <BannerPanel banners={banners} now={getRequestTime()} />
      </section>
    );
  });
}

export async function RoomsSection() {
  return guarded("Community rooms", async () => {
    const rows = must(
      await createAdminClient()
        .from("rooms")
        .select("id, name, is_public, suspended, owner_id, profiles!rooms_owner_id_fkey(username), room_members(count)")
        .order("created_at", { ascending: false })
        .limit(50),
    );
    const rooms: AdminRoom[] = ((rows ?? []) as unknown as Array<{
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
    return (
      <section className="space-y-3">
        <SectionHeading title="Community rooms" count={rooms.length} />
        {rooms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No rooms yet.</p>
        ) : (
          <RoomsPanel rooms={rooms} />
        )}
      </section>
    );
  });
}

export async function PrizePoolSection() {
  return guarded("Weekly prize pool", async () => {
    const admin = createAdminClient();
    const weekDates = await Promise.all(
      [1, 0, -1].map(async (n) => {
        const d = must(await admin.rpc("week_start_date", { p_weeks_ago: n }));
        return typeof d === "string" ? d : "";
      }),
    );
    const dates = weekDates.filter(Boolean);
    const poolRows = (must(await admin.from("weekly_prizes").select("*").in("week_start", dates)) ?? []) as Array<{
      week_start: string;
      pool_kobo: number;
      status: "open" | "paid";
    }>;
    const now = getRequestTime();
    const weeks: PoolWeek[] = await Promise.all(
      weekDates.map(async (d, i) => {
        if (!d) return null;
        const row = poolRows.find((r) => r.week_start === d);
        let standings: PoolWeek["standings"] = [];
        if (row?.status === "paid") {
          const paid = must(
            await admin.from("weekly_prize_payouts").select("rank, amount_kobo, profit_kobo, profiles(username)").eq("week_start", d).order("rank"),
          );
          standings = ((paid ?? []) as unknown as Array<{ rank: number; amount_kobo: number; profit_kobo: number; profiles: { username: string } | null }>).map(
            (p) => ({ rank: p.rank, username: p.profiles?.username ?? "member", profitKobo: Number(p.profit_kobo), markets: null, prizeKobo: Number(p.amount_kobo) }),
          );
        } else if (i < 2 && Number(row?.pool_kobo ?? 0) > 0) {
          // Only compute standings when there's a pool to split (saves a heavy query on empty weeks).
          const st = must(await admin.rpc("prize_standings", { p_week: d }));
          standings = ((st ?? []) as Array<{ rank: number; username: string; profit_kobo: number; markets: number; prize_kobo: number }>).map((r) => ({
            rank: r.rank,
            username: r.username,
            profitKobo: Number(r.profit_kobo),
            markets: r.markets,
            prizeKobo: Number(r.prize_kobo),
          }));
        }
        const start = new Date(`${d}T00:00:00+01:00`).getTime();
        return {
          weekStart: d,
          label: `${["Last week", "This week", "Next week"][i]} · from ${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          poolKobo: Number(row?.pool_kobo ?? 0),
          status: (row?.status ?? "none") as PoolWeek["status"],
          ended: start + 7 * 86_400_000 <= now,
          standings,
        };
      }),
    ).then((w) => w.filter((x): x is PoolWeek => x !== null));
    return (
      <section className="space-y-3">
        <SectionHeading title="Weekly prize pool" />
        <p className="text-xs text-muted">
          The top 5 on the week’s leaderboard (in profit) win 40% / 25% / 15% / 12% / 8%. Pay after the week ends (Sunday
          night, Lagos time).
        </p>
        <PrizePoolPanel weeks={weeks} />
      </section>
    );
  });
}

export async function SchedulesSection() {
  return guarded("Repeating markets", async () => {
    const [rows, active, all] = await Promise.all([
      createAdminClient().from("market_schedules").select("*").order("created_at").then(must),
      getActiveSchools(),
      getSchools(),
    ]);
    const schoolOf = Object.fromEntries(all.map((s) => [s.id, s.short_name]));
    const schedules = ((rows ?? []) as Array<Omit<ScheduleRow, "school"> & { school_id: string }>).map((sc) => ({
      ...sc,
      school: schoolOf[sc.school_id] ?? sc.school_id,
    }));
    return (
      <section className="space-y-3">
        <SectionHeading title="Repeating markets" count={schedules.length} />
        <SchedulePanel schools={[{ id: GENERAL_SCHOOL_ID, short_name: "All universities" }, ...active.map((sc) => ({ id: sc.id, short_name: sc.short_name }))]} schedules={schedules} />
      </section>
    );
  });
}

export async function ProposersSection() {
  return guarded("Who can propose markets", async () => {
    const rows = (must(await createAdminClient().from("profiles").select("username").eq("can_propose", true).order("username")) ?? []) as Array<{
      username: string;
    }>;
    return (
      <section className="space-y-3">
        <SectionHeading title="Who can propose markets" count={rows.length} />
        <ProposerPanel proposers={rows.map((p) => p.username)} />
      </section>
    );
  });
}

export async function PartnersSection() {
  return guarded("Partner invite rates", async () => {
    const [rows, settings] = await Promise.all([createAdminClient().rpc("partner_stats").then(must), getSettings()]);
    const partners: Partner[] = ((rows ?? []) as Array<{ username: string; rate_bps: number; joined: number; active: number }>).map((p) => ({
      username: p.username,
      ratePct: p.rate_bps / 100,
      joined: p.joined,
      active: p.active,
    }));
    return (
      <section className="space-y-3">
        <SectionHeading title="Partner invite rates" count={partners.length} />
        <PartnerPanel partners={partners} standardPct={settings.referral_share_bps / 100} />
      </section>
    );
  });
}

export async function TransfersSection() {
  return guarded("Recent member transfers", async () => {
    const admin = createAdminClient();
    const transfers = (must(
      await admin.from("transfers").select("id, from_user, to_user, amount_kobo, note, created_at").order("created_at", { ascending: false }).limit(50),
    ) ?? []) as Array<{ id: string; from_user: string; to_user: string; amount_kobo: number; note: string | null; created_at: string }>;
    const ids = [...new Set(transfers.flatMap((t) => [t.from_user, t.to_user]))];
    const users = ids.length ? ((must(await admin.from("profiles").select("id, username").in("id", ids)) ?? []) as Array<{ id: string; username: string }>) : [];
    const name = new Map(users.map((u) => [u.id, u.username]));
    return (
      <section className="space-y-3">
        <SectionHeading title="Recent member transfers" count={transfers.length} />
        {transfers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No member transfers yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-white">
                  @{name.get(t.from_user) ?? "?"} → @{name.get(t.to_user) ?? "?"}
                  {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold text-white">{formatNaira(t.amount_kobo)}</span>
                  <span className="text-[11px] text-muted">{formatDate(t.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  });
}

export async function LiquiditySection() {
  return guarded("Market liquidity", async () => {
    const admin = createAdminClient();
    const [{ data: s }, { data: open }] = await Promise.all([
      admin.from("settings").select("amm_liquidity_kobo").eq("id", 1).single<{ amm_liquidity_kobo: number }>(),
      admin.from("markets").select("liquidity_kobo").eq("status", "open").eq("engine", "amm"),
    ]);
    const rows = (open ?? []) as Array<{ liquidity_kobo: number | null }>;
    return (
      <section className="space-y-3">
        <SectionHeading title="Market liquidity" />
        <LiquidityPanel
          currentKobo={Number(s?.amm_liquidity_kobo ?? 10_000_000)}
          openMarkets={rows.length}
          openLiquidityKobo={rows.reduce((t, r) => t + Number(r.liquidity_kobo ?? 0), 0)}
        />
      </section>
    );
  });
}

export async function RewardsSection() {
  return guarded("Tasks & streak", async () => {
    const admin = createAdminClient();
    const lagosToday = new Date(getRequestTime() + 3_600_000).toISOString().slice(0, 10);
    const weekAgo = new Date(getRequestTime() - 7 * 86_400_000).toISOString();
    const [{ data: s }, tasksRes, claimsRes, today, week] = await Promise.all([
      admin.from("settings").select("streak_rewards_kobo").eq("id", 1).single<{ streak_rewards_kobo: number[] }>(),
      admin.from("reward_tasks").select("*").order("sort").order("created_at"),
      admin.from("task_claims").select("task_id"),
      admin.from("streak_claims").select("user_id", { count: "exact", head: true }).eq("day", lagosToday),
      admin.from("streak_claims").select("reward_kobo").gte("claimed_at", weekAgo),
    ]);
    const counts = new Map<string, number>();
    for (const c of (must(claimsRes) ?? []) as Array<{ task_id: string }>) counts.set(c.task_id, (counts.get(c.task_id) ?? 0) + 1);
    const tasks: AdminTask[] = ((must(tasksRes) ?? []) as Array<Omit<AdminTask, "claims">>).map((t) => ({ ...t, claims: counts.get(t.id) ?? 0 }));
    const paidWeekKobo = ((week.data ?? []) as Array<{ reward_kobo: number }>).reduce((t, r) => t + Number(r.reward_kobo), 0);
    return (
      <section className="space-y-3">
        <SectionHeading title="Tasks & streak" />
        <RewardsPanel
          rewardsKobo={(s?.streak_rewards_kobo ?? [2000, 3000, 5000, 7000, 10000, 15000, 30000]).map(Number)}
          tasks={tasks}
          claimsToday={today.count ?? 0}
          paidWeekKobo={paidWeekKobo}
        />
      </section>
    );
  });
}
