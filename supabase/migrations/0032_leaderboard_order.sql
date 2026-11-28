-- =====================================================================
-- UniPred 0032: leaderboard order. Members who traded in the period come
-- first (highest profit down to biggest loss); members with no trades in
-- the period are listed after them. Safe to run more than once.
-- =====================================================================

-- p_period: 'week' (this week), 'last_week' or 'all'.
create or replace function public.leaderboard(p_period text default 'week', p_school text default null, p_limit int default 50)
returns table (rank int, username text, school_id text, profit_kobo bigint, markets int, won int)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select case p_period when 'all' then '-infinity'::timestamptz
                         when 'last_week' then public.season_start(1)
                         else public.season_start(0) end as s,
           case p_period when 'all' then 'infinity'::timestamptz
                         when 'last_week' then public.season_start(0)
                         else public.season_start(0) + interval '7 days' end as e
  ),
  scored as (
    select r.uid as user_id,
           sum(r.profit_kobo)::bigint as profit,
           count(distinct r.mid)::int as markets,
           count(distinct r.mid) filter (where r.won)::int as won
      from bounds b cross join lateral public._realized_pnl(b.s, b.e) r
     group by r.uid
  )
  -- Everyone is listed: in profit, in loss, or with nothing yet this period (0).
  -- Members who traded come first (best profit down to biggest loss); members with no trades go last.
  select (row_number() over (order by (coalesce(sc.markets, 0) > 0) desc, coalesce(sc.profit, 0) desc,
                                      coalesce(sc.won, 0) desc, coalesce(sc.markets, 0) desc, p.username))::int,
         p.username, p.school_id, coalesce(sc.profit, 0)::bigint, coalesce(sc.markets, 0)::int, coalesce(sc.won, 0)::int
    from public.profiles p left join scored sc on sc.user_id = p.id
   where not p.is_banned and not p.leaderboard_hidden
     and (p_school is null or p.school_id = p_school)
   order by 1
   limit greatest(1, least(p_limit, 1000));
$$;

grant execute on function public.leaderboard(text, text, int) to anon, authenticated;
