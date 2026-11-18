import { Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getSchools } from "@/lib/data";
import { formatNaira, timeLeft } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getRequestTime } from "@/lib/time";
import { LeaderboardControls, type Period } from "./LeaderboardControls";

export const metadata: Metadata = {
  title: "Leaderboard · UniPred",
  description: "Top predictors on UniPred this week and of all time.",
};

interface Row {
  rank: number;
  username: string;
  school_id: string;
  profit_kobo: number;
  markets: number;
  won: number;
}

const MEDAL = ["text-amber-300", "text-slate-300", "text-amber-600"];

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const sp = await props.searchParams;
  const period: Period = sp.period === "last_week" || sp.period === "all" ? sp.period : "week";
  const [viewer, allSchools, activeSchools] = await Promise.all([getViewer(), getSchools(), getActiveSchools()]);
  const school = typeof sp.school === "string" && activeSchools.some((s) => s.id === sp.school) ? sp.school : "all";

  const supabase = await createClient();
  const [{ data: rows }, { data: startIso }, { data: prizeRows }] = await Promise.all([
    supabase.rpc("leaderboard", { p_period: period, p_school: school === "all" ? null : school, p_limit: 100 }),
    period === "all" ? Promise.resolve({ data: null }) : supabase.rpc("prize_board", { p_weeks_ago: period === "last_week" ? 1 : 0 }),
    supabase.rpc("season_start", { p_weeks_ago: period === "last_week" ? 1 : 0 }),
  ]);
  const board = (rows ?? []) as Row[];
  const prizeList = (prizeRows ?? []) as Array<{ pool_kobo: number; status: string; rank: number | null; username: string | null; prize_kobo: number | null }>;
  const prize = prizeList.length
    ? {
        pool: Number(prizeList[0].pool_kobo ?? 0),
        status: prizeList[0].status,
        rows: prizeList.filter((r) => r.rank !== null) as Array<{ rank: number; username: string | null; prize_kobo: number }>,
      }
    : null;
  const schoolLabel = Object.fromEntries(allSchools.map((s) => [s.id, s.short_name]));
  const now = getRequestTime();
  const start = typeof startIso === "string" ? new Date(startIso).getTime() : now;
  const end = start + 7 * 86_400_000;
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
  const subtitle =
    period === "all"
      ? "All-time profit on resolved markets"
      : `${fmt(start)} – ${fmt(end - 1)} · ${period === "week" ? `resets in ${timeLeft(end, now).replace(" left", "")}` : "final standings"}`;
  const mine = viewer ? board.find((r) => r.username === viewer.profile.username) : undefined;
  const podium = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <Container>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          <Trophy className="size-6 text-brand" /> Leaderboard
        </h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>

      <div className="mb-4">
        <LeaderboardControls schools={activeSchools} school={school} period={period} mySchoolId={viewer?.profile.school_id ?? null} />
      </div>

      {prize && prize.pool > 0 && (
        <section className="mb-4 overflow-hidden rounded-3xl border border-amber-400/30 bg-linear-to-br from-amber-400/15 via-card to-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                {prize.status === "paid" ? "Prize pool · paid" : period === "week" ? "This week's prize pool" : "Last week's prize pool"}
              </p>
              <p className="text-3xl font-black tabular-nums text-white">{formatNaira(prize.pool)}</p>
            </div>
            <Trophy className="size-10 shrink-0 text-amber-300" />
          </div>
          <ol className="mt-3 space-y-1.5">
            {[0.4, 0.25, 0.15, 0.12, 0.08].map((share, i) => {
              const r = prize.rows.find((x) => x.rank === i + 1);
              return (
                <li key={share} className="flex items-center justify-between gap-2 rounded-xl bg-bg/70 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className={`mr-2 font-extrabold ${MEDAL[i] ?? "text-muted"}`}>#{i + 1}</span>
                    {r ? (
                      <span className="font-semibold text-white">{r.username ? `@${r.username}` : "A member"}</span>
                    ) : (
                      <span className="text-muted">Up for grabs</span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-amber-300">
                    {formatNaira(r?.prize_kobo ?? Math.floor(prize.pool * share))}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[11px] text-muted">
            Top 5 by profit on markets with 3+ bettors. Play at least 5 of them in the week to qualify. Paid to your wallet
            after Sunday.
          </p>
        </section>
      )}

      {mine ? (
        <p className="mb-4 rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">
          You&apos;re <b>#{mine.rank}</b> with <b>+{formatNaira(mine.profit_kobo)}</b> profit.
        </p>
      ) : viewer ? (
        <p className="mb-4 rounded-xl bg-card px-3 py-2 text-xs text-muted">
          You&apos;re not on this board yet.
        </p>
      ) : null}

      {board.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          No one in profit {period === "week" ? "this week" : period === "last_week" ? "last week" : "yet"}.
        </div>
      ) : (
        <>
          {/* Podium */}
          <ol className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {podium.map((r) => {
              const isMe = viewer?.profile.username === r.username;
              return (
                <li
                  key={r.username}
                  className={`flex items-center gap-3 rounded-2xl border p-4 ${
                    r.rank === 1 ? "border-brand/40 bg-linear-to-br from-brand/15 to-card" : "border-line bg-card"
                  } ${isMe ? "ring-2 ring-brand/60" : ""}`}
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-bg ${MEDAL[r.rank - 1]}`}>
                    <Medal className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-white">@{r.username}</span>
                    <span className="text-[11px] text-muted">
                      {schoolLabel[r.school_id] ?? r.school_id} · won {r.won} of {r.markets}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] text-muted">#{r.rank}</span>
                    <span className="font-extrabold tabular-nums text-yes">+{formatNaira(r.profit_kobo)}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {rest.map((r) => {
                const isMe = viewer?.profile.username === r.username;
                return (
                  <li key={r.username} className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-brand/10" : ""}`}>
                    <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-muted">{r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold ${isMe ? "text-brand" : "text-white"}`}>@{r.username}</span>
                      <span className="text-[11px] text-muted">
                        {schoolLabel[r.school_id] ?? r.school_id} · won {r.won} of {r.markets}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-yes">+{formatNaira(r.profit_kobo)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Profit on resolved markets. Hide yourself in{" "}
        <Link href="/settings" className="text-brand underline">
          Settings
        </Link>
        .
      </p>
    </Container>
  );
}
