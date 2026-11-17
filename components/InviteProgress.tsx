import { CheckCircle2, Flame } from "lucide-react";

export interface ReferralStats {
  rate_bps: number;
  is_partner: boolean;
  joined: number;
  active: number;
  min_daily_bets: number;
  streak_days: number;
  friends: Array<{ username: string; qualified: boolean; best_streak: number; bets_today: number }>;
}

/** Each invited friend's progress toward becoming active (N bets a day, K days in a row). */
export function InviteProgress({ stats }: { stats: ReferralStats }) {
  if (stats.friends.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-bg">
      {stats.friends.map((f) => (
        <li key={f.username} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="truncate font-semibold text-white">@{f.username}</span>
          {f.qualified ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-yes">
              <CheckCircle2 className="size-3.5" /> Active, earning
            </span>
          ) : (
            <span className="shrink-0 text-right text-xs text-muted">
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Flame className="size-3.5" />
                {f.best_streak}/{stats.streak_days} days
              </span>
              <span className="block">
                {Math.min(f.bets_today, stats.min_daily_bets)}/{stats.min_daily_bets} bets today
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
