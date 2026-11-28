-- =====================================================================
-- UniPred 0031: the leaderboard counts profit WHEN IT HAPPENS, whatever
-- week the market was created in.
--
--   * Cash-out: the profit or loss locked in by a cash-out counts in the week
--     of the cash-out (sale amount minus what those shares cost on average;
--     for pool markets, the exit fee).
--   * Result: when a market settles (resolved or cancelled), the rest of the
--     member's profit or loss on it counts in the week it settles. Anything
--     already counted from cash-outs isn't counted twice.
--
-- Used by the leaderboard and by the weekly prize standings, so both agree.
-- Room questions still don't count. Safe to run more than once.
-- =====================================================================

create index if not exists trades_user_market_idx on public.trades (user_id, market_id, outcome, side, created_at);

/** Profit/loss realised between p_start and p_end, per member and market. */
create or replace function public._realized_pnl(p_start timestamptz, p_end timestamptz)
returns table (uid uuid, mid uuid, profit_kobo bigint, won boolean)
language sql stable security definer set search_path = public as $$
  with sells as (
    -- Each cash-out: what it returned minus the cost of what was sold.
    select t.user_id as u, t.market_id as m, t.created_at as at,
           case when t.shares > 0 then
             t.amount_kobo - t.shares * coalesce((
               select sum(b.amount_kobo)::numeric / nullif(sum(b.shares), 0)
                 from public.trades b
                where b.user_id = t.user_id and b.market_id = t.market_id and b.outcome = t.outcome
                  and b.side = 'buy' and b.shares > 0 and b.created_at <= t.created_at), 0)
           else -t.fee_kobo   -- pool markets: you get your stake back minus the exit fee
           end as realized
      from public.trades t
      join public.markets mk on mk.id = t.market_id
     where t.side = 'sell' and t.user_id is not null and mk.room_id is null
  ),
  sell_totals as (
    select u, m, sum(realized) as r from sells group by u, m
  ),
  settled as (
    -- Markets that settled in the window: the member's whole result on it...
    select l.user_id as u, l.market_id as m, sum(l.amount_kobo)::numeric as total, bool_or(l.kind = 'payout') as won
      from public.ledger l
      join public.markets mk on mk.id = l.market_id
     where mk.status in ('resolved', 'cancelled') and mk.room_id is null
       and mk.resolved_at >= p_start and mk.resolved_at < p_end
       and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id, l.market_id
  ),
  events as (
    select s.u, s.m, s.realized as p, false as w from sells s
     where s.at >= p_start and s.at < p_end
    union all
    -- ...minus what its cash-outs already counted.
    select st.u, st.m, st.total - coalesce(t.r, 0), st.won
      from settled st left join sell_totals t on t.u = st.u and t.m = st.m
  )
  select e.u, e.m, round(sum(e.p))::bigint, bool_or(e.w)
    from events e
   group by e.u, e.m;
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
    select r.uid as user_id,
           sum(r.profit_kobo)::bigint as profit,
           count(distinct r.mid)::int as markets,
           count(distinct r.mid) filter (where r.won)::int as won
      from bounds b cross join lateral public._realized_pnl(b.s, b.e) r
     group by r.uid
  )
  -- Everyone is listed: in profit, in loss, or with nothing yet this period (0).
  select (row_number() over (order by coalesce(sc.profit, 0) desc, coalesce(sc.won, 0) desc,
                                      coalesce(sc.markets, 0) desc, p.username))::int,
         p.username, p.school_id, coalesce(sc.profit, 0)::bigint, coalesce(sc.markets, 0)::int, coalesce(sc.won, 0)::int
    from public.profiles p left join scored sc on sc.user_id = p.id
   where not p.is_banned and not p.leaderboard_hidden
     and (p_school is null or p.school_id = p_school)
   order by 1
   limit greatest(1, least(p_limit, 1000));
$$;

-- Weekly prize: same profit rule. Only markets with 3+ traders count; winners need 5+ of them.
create or replace function public.prize_standings(p_week date)
returns table (rank int, user_id uuid, username text, hidden boolean, school_id text,
               profit_kobo bigint, markets int, prize_kobo bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select (p_week::timestamp at time zone 'Africa/Lagos') as s,
           ((p_week + 7)::timestamp at time zone 'Africa/Lagos') as e
  ),
  realized as (
    select r.* from b cross join lateral public._realized_pnl(b.s, b.e) r
     where (select count(distinct l.user_id) from public.ledger l where l.market_id = r.mid and l.kind = 'trade_buy') >= 3
  ),
  scored as (
    select r.uid as user_id, sum(r.profit_kobo)::bigint as profit, count(distinct r.mid)::int as markets
      from realized r group by r.uid
  ),
  ranked as (
    select (row_number() over (order by sc.profit desc, sc.markets desc, p.username))::int as rank,
           sc.user_id, p.username, p.leaderboard_hidden, p.school_id, sc.profit, sc.markets
      from scored sc join public.profiles p on p.id = sc.user_id
     where sc.profit > 0 and sc.markets >= 5 and not p.is_banned
  ),
  pool as (select coalesce((select pool_kobo from public.weekly_prizes where week_start = p_week), 0) as kobo)
  select r.rank, r.user_id, r.username, r.leaderboard_hidden, r.school_id, r.profit, r.markets,
         floor((select kobo from pool) * (array[0.40, 0.25, 0.15, 0.12, 0.08])[r.rank])::bigint
    from ranked r
   where r.rank <= 5
   order by r.rank;
$$;

revoke execute on function public._realized_pnl(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public._realized_pnl(timestamptz, timestamptz) to service_role;
grant execute on function public.leaderboard(text, text, int) to anon, authenticated;
revoke execute on function public.prize_standings(date) from public, anon, authenticated;
grant execute on function public.prize_standings(date) to service_role;
