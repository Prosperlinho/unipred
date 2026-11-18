-- =====================================================================
-- UniPred 0013: leaderboard.
-- Members are ranked by profit (winnings + cash-outs + refunds minus
-- stakes) on markets resolved in the period: this week, last week or
-- all time (weeks run Monday to Sunday, Lagos time). Only people in
-- profit are listed. Suspended members and anyone who hides themselves
-- (Settings) are left out. Run after 0012. Safe to run more than once.
-- =====================================================================

alter table public.profiles
  add column if not exists leaderboard_hidden boolean not null default false;
grant update (leaderboard_hidden) on public.profiles to authenticated;

create or replace function public.season_start(p_weeks_ago int default 0)
returns timestamptz language sql stable as $$
  select (date_trunc('week', (now() at time zone 'Africa/Lagos')) - make_interval(weeks => p_weeks_ago)) at time zone 'Africa/Lagos';
$$;

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
    select l.user_id,
           sum(l.amount_kobo)::bigint as profit,
           count(distinct l.market_id)::int as markets,
           count(distinct l.market_id) filter (where l.kind = 'payout')::int as won
      from public.ledger l
      join public.markets m on m.id = l.market_id
      cross join bounds b
     where m.status = 'resolved' and m.resolved_at >= b.s and m.resolved_at < b.e
       and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id
  )
  select (row_number() over (order by sc.profit desc, sc.won desc, p.username))::int,
         p.username, p.school_id, sc.profit, sc.markets, sc.won
    from scored sc join public.profiles p on p.id = sc.user_id
   where sc.profit > 0 and not p.is_banned and not p.leaderboard_hidden
     and (p_school is null or p.school_id = p_school)
   order by 1
   limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.leaderboard(text, text, int) from public;
grant execute on function public.leaderboard(text, text, int) to anon, authenticated;
grant execute on function public.season_start(int) to anon, authenticated;
