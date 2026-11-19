import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Shared, public data that's the same for every visitor, cached for a minute.
 * With hundreds of people on the leaderboard at once, the database computes the rankings
 * once a minute instead of once per page view. No cookies are used inside the cache
 * (it reads with the public anon key), so nothing personal is ever cached.
 */

const CACHE_SECONDS = 60;

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface BoardRow {
  rank: number;
  username: string;
  school_id: string;
  profit_kobo: number;
  markets: number;
  won: number;
}

/** Leaderboard rankings for a period ("week" | "last_week" | "all") and optional school. */
export const getCachedLeaderboard = unstable_cache(
  async (period: string, school: string | null, limit: number): Promise<BoardRow[]> => {
    const { data, error } = await publicClient().rpc("leaderboard", { p_period: period, p_school: school, p_limit: limit });
    if (error) throw new Error(error.message); // don't cache failures
    return Array.isArray(data) ? (data as BoardRow[]) : [];
  },
  ["leaderboard-v1"],
  { revalidate: CACHE_SECONDS, tags: ["leaderboard"] },
);

/** Weekly prize pool board (pool size + top 5) for this week (0) or last week (1). */
export const getCachedPrizeBoard = unstable_cache(
  async (weeksAgo: number): Promise<unknown[]> => {
    const { data, error } = await publicClient().rpc("prize_board", { p_weeks_ago: weeksAgo });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  },
  ["prize-board-v1"],
  { revalidate: CACHE_SECONDS, tags: ["leaderboard"] },
);

/** Start of the leaderboard week (Monday, Lagos time) as an ISO string. */
export const getCachedSeasonStart = unstable_cache(
  async (weeksAgo: number): Promise<string | null> => {
    const { data, error } = await publicClient().rpc("season_start", { p_weeks_ago: weeksAgo });
    if (error) throw new Error(error.message);
    return typeof data === "string" ? data : null;
  },
  ["season-start-v1"],
  { revalidate: CACHE_SECONDS },
);
