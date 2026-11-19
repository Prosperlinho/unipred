-- =====================================================================
-- UniPred 0023: the leaderboard lists every member (not only those in
-- profit): profit, loss, or 0 for members with no bets yet in the period.
-- Suspended members and anyone who hides themselves (Settings) stay off.
-- Room questions still do not count. Safe to run more than once.
-- =====================================================================

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
    select l.user_id,
           sum(l.amount_kobo)::bigint as profit,
           count(distinct l.market_id)::int as markets,
           count(distinct l.market_id) filter (where l.kind = 'payout')::int as won
      from public.ledger l
      join public.markets m on m.id = l.market_id
      cross join bounds b
     where m.status = 'resolved' and m.resolved_at >= b.s and m.resolved_at < b.e and m.room_id is null
       and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id
  )
  -- Everyone is listed: in profit, in loss, or with no bets yet (0).
  select (row_number() over (order by coalesce(sc.profit, 0) desc, coalesce(sc.won, 0) desc,
                                      coalesce(sc.markets, 0) desc, p.username))::int,
         p.username, p.school_id, coalesce(sc.profit, 0)::bigint, coalesce(sc.markets, 0)::int, coalesce(sc.won, 0)::int
    from public.profiles p left join scored sc on sc.user_id = p.id
   where not p.is_banned and not p.leaderboard_hidden
     and (p_school is null or p.school_id = p_school)
   order by 1
   limit greatest(1, least(p_limit, 1000));
$$;

grant execute on function public.leaderboard(text, text, int) to anon, authenticated;
