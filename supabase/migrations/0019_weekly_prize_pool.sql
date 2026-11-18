-- =====================================================================
-- UniPred 0019: weekly prize pool (real naira) for the top 5.
--   * The admin sets a fixed pool per week (Monday to Sunday, Lagos time).
--   * Split: 1st 40%, 2nd 25%, 3rd 15%, 4th 12%, 5th 8%.
--   * Ranking = profit on markets resolved that week, counting only
--     markets with at least 3 different bettors, and only members who
--     played at least 5 such markets (stops two friends farming a prize).
--   * After the week ends the admin reviews and taps "Pay winners":
--     prizes are credited to wallets (withdrawable like winnings).
-- Run after 0018. Safe to run more than once.
-- =====================================================================

alter type public.ledger_kind add value if not exists 'prize';

create table if not exists public.weekly_prizes (
  week_start date primary key,              -- Monday (Lagos)
  pool_kobo bigint not null check (pool_kobo >= 0),
  status text not null default 'open' check (status in ('open', 'paid')),
  paid_at timestamptz,
  paid_kobo bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.weekly_prizes enable row level security;
drop policy if exists "prize pools are public" on public.weekly_prizes;
create policy "prize pools are public" on public.weekly_prizes for select using (true);
revoke insert, update, delete on public.weekly_prizes from anon, authenticated;
grant select on public.weekly_prizes to anon, authenticated;

create table if not exists public.weekly_prize_payouts (
  week_start date not null references public.weekly_prizes (week_start) on delete cascade,
  rank int not null,
  user_id uuid not null references public.profiles (id),
  amount_kobo bigint not null,
  profit_kobo bigint not null,
  created_at timestamptz not null default now(),
  primary key (week_start, rank)
);
alter table public.weekly_prize_payouts enable row level security;
drop policy if exists "prize payouts are public" on public.weekly_prize_payouts;
create policy "prize payouts are public" on public.weekly_prize_payouts for select using (true);
revoke insert, update, delete on public.weekly_prize_payouts from anon, authenticated;
grant select on public.weekly_prize_payouts to anon, authenticated;

-- Lagos Monday for "this week" (0) or N weeks ago.
create or replace function public.week_start_date(p_weeks_ago int default 0)
returns date language sql stable as $$
  select (public.season_start(p_weeks_ago) at time zone 'Africa/Lagos')::date;
$$;

-- Prize standings for a week: top 5 eligible members and what each would get.
create or replace function public.prize_standings(p_week date)
returns table (rank int, user_id uuid, username text, hidden boolean, school_id text,
               profit_kobo bigint, markets int, prize_kobo bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select (p_week::timestamp at time zone 'Africa/Lagos') as s,
           ((p_week + 7)::timestamp at time zone 'Africa/Lagos') as e
  ),
  eligible_markets as (
    select m.id from public.markets m cross join b
     where m.status = 'resolved' and m.resolved_at >= b.s and m.resolved_at < b.e
       and (select count(distinct l.user_id) from public.ledger l where l.market_id = m.id and l.kind = 'trade_buy') >= 3
  ),
  scored as (
    select l.user_id, sum(l.amount_kobo)::bigint as profit, count(distinct l.market_id)::int as markets
      from public.ledger l join eligible_markets em on em.id = l.market_id
     where l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id
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

-- Public view: the pool and the top 5 (no user ids; hidden members shown without a name).
-- Before payout it shows the live standings; after payout, exactly who was paid.
create or replace function public.prize_board(p_weeks_ago int default 0)
returns table (week_start date, pool_kobo bigint, status text, rank int, username text,
               school_id text, profit_kobo bigint, prize_kobo bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_week date := public.week_start_date(p_weeks_ago); wp public.weekly_prizes;
begin
  select * into wp from public.weekly_prizes w where w.week_start = v_week;
  if wp.status = 'paid' then
    return query
      select v_week, wp.pool_kobo, wp.status, pp.rank,
             case when p.leaderboard_hidden then null else p.username end, p.school_id, pp.profit_kobo, pp.amount_kobo
        from public.weekly_prize_payouts pp join public.profiles p on p.id = pp.user_id
       where pp.week_start = v_week order by pp.rank;
  else
    return query
      select v_week, coalesce(wp.pool_kobo, 0), coalesce(wp.status, 'none'), st.rank,
             case when st.hidden then null else st.username end, st.school_id, st.profit_kobo, st.prize_kobo
        from public.prize_standings(v_week) st order by st.rank;
    -- Always return the pool, even with nobody eligible yet.
    if not found then
      return query select v_week, coalesce(wp.pool_kobo, 0), coalesce(wp.status, 'none'), null::int, null::text, null::text, null::bigint, null::bigint;
    end if;
  end if;
end $$;

-- Admin: credit the winners of a finished week.
create or replace function public.pay_weekly_prizes(p_week date)
returns json language plpgsql security definer set search_path = public as $$
declare wp public.weekly_prizes; r record; v_total bigint := 0; v_count int := 0;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into wp from public.weekly_prizes where week_start = p_week for update;
  if not found or wp.pool_kobo <= 0 then raise exception 'No prize pool was set for that week'; end if;
  if wp.status = 'paid' then raise exception 'This week''s prizes were already paid'; end if;
  if ((p_week + 7)::timestamp at time zone 'Africa/Lagos') > now() then
    raise exception 'The week isn''t over yet';
  end if;

  for r in select * from public.prize_standings(p_week) where prize_kobo > 0 order by rank loop
    insert into public.weekly_prize_payouts (week_start, rank, user_id, amount_kobo, profit_kobo)
    values (p_week, r.rank, r.user_id, r.prize_kobo, r.profit_kobo);
    perform public._wallet_move(r.user_id, r.prize_kobo, 'prize', null, 'week:' || p_week,
      format('Weekly prize: #%s (%s)', r.rank, to_char(p_week, 'DD Mon')));
    perform public._notify(r.user_id, 'prize', format('You won %s in the weekly prize pool 🏆', public._naira(r.prize_kobo)),
      format('You finished #%s on the leaderboard for the week of %s.', r.rank, to_char(p_week, 'DD Mon')), '/wallet');
    v_total := v_total + r.prize_kobo;
    v_count := v_count + 1;
  end loop;

  update public.weekly_prizes set status = 'paid', paid_at = now(), paid_kobo = v_total, updated_at = now()
   where week_start = p_week;
  return json_build_object('winners', v_count, 'paid_kobo', v_total, 'unused_kobo', wp.pool_kobo - v_total);
end $$;

revoke execute on function public.prize_standings(date) from public, anon, authenticated;
grant execute on function public.prize_standings(date) to service_role;
grant execute on function public.prize_board(int) to anon, authenticated;
grant execute on function public.week_start_date(int) to anon, authenticated;
revoke execute on function public.pay_weekly_prizes(date) from public, anon;
grant execute on function public.pay_weekly_prizes(date) to authenticated; -- checks is_admin()
