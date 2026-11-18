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
  const [{ data: rows }, { data: startIso }] = await Promise.all([
    supabase.rpc("leaderboard", { p_period: period, p_school: school === "all" ? null : school, p_limit: 100 }),
    supabase.rpc("season_start", { p_weeks_ago: period === "last_week" ? 1 : 0 }),
  ]);
  const board = (rows ?? []) as Row[];
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
