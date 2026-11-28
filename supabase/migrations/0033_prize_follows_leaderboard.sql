-- =====================================================================
-- UniPred 0033: the weekly prize pool follows the leaderboard.
-- The top 5 on that week's leaderboard win 40/25/15/12/8% of the pool.
-- No more "3+ traders per market" or "5 markets" rules. Only members in
-- profit for the week can win (nobody is paid for losing).
-- Members who hide themselves from the leaderboard aren't in the top 5,
-- so the prize list always matches what everyone sees. Safe to re-run.
-- =====================================================================

create or replace function public.prize_standings(p_week date)
returns table (rank int, user_id uuid, username text, hidden boolean, school_id text,
               profit_kobo bigint, markets int, prize_kobo bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select (p_week::timestamp at time zone 'Africa/Lagos') as s,
           ((p_week + 7)::timestamp at time zone 'Africa/Lagos') as e
  ),
  scored as (
    select r.uid as user_id, sum(r.profit_kobo)::bigint as profit,
           count(distinct r.mid)::int as markets,
           count(distinct r.mid) filter (where r.won)::int as won
      from b cross join lateral public._realized_pnl(b.s, b.e) r
     group by r.uid
  ),
  ranked as (
    -- Same order as the leaderboard.
    select (row_number() over (order by sc.profit desc, sc.won desc, sc.markets desc, p.username))::int as rank,
           sc.user_id, p.username, p.leaderboard_hidden, p.school_id, sc.profit, sc.markets
      from scored sc join public.profiles p on p.id = sc.user_id
     where sc.profit > 0 and not p.is_banned and not p.leaderboard_hidden
  ),
  pool as (select coalesce((select pool_kobo from public.weekly_prizes where week_start = p_week), 0) as kobo)
  select r.rank, r.user_id, r.username, r.leaderboard_hidden, r.school_id, r.profit, r.markets,
         floor((select kobo from pool) * (array[0.40, 0.25, 0.15, 0.12, 0.08])[r.rank])::bigint
    from ranked r
   where r.rank <= 5
   order by r.rank;
$$;

revoke execute on function public.prize_standings(date) from public, anon, authenticated;
grant execute on function public.prize_standings(date) to service_role;
