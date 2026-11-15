-- =====================================================================
-- 0005: switch from house-backed fixed odds to POOL (parimutuel) betting.
-- UniPred no longer risks its own money:
--   * every bet goes into the market's YES or NO pot
--   * winners get their stake back plus a share of the losing pot,
--     in proportion to their stake, minus UniPred's fee on those winnings
--   * nobody bet on the losing side  -> winners just get their stake back
--   * nobody backed the winning side -> everyone is refunded
-- Run once, after 0001-0004.
-- =====================================================================

alter table public.markets
  add column if not exists engine text not null default 'pool' check (engine in ('pool', 'amm')),
  add column if not exists stake_yes_kobo bigint not null default 0 check (stake_yes_kobo >= 0),
  add column if not exists stake_no_kobo bigint not null default 0 check (stake_no_kobo >= 0);

alter table public.settings
  add column if not exists pool_fee_bps int not null default 1000 check (pool_fee_bps between 0 and 3000); -- 1000 = 10% of winnings

-- Markets that already finished under the old engine keep their history.
update public.markets set engine = 'amm' where status in ('resolved', 'cancelled');

-- Open markets restart as pools: refund every existing bet on them first.
do $$
declare r record;
begin
  for r in
    select p.user_id, p.market_id, sum(p.cost_kobo)::bigint as cost
      from public.positions p join public.markets m on m.id = p.market_id
     where m.status = 'open'
     group by p.user_id, p.market_id
     order by p.user_id
  loop
    if r.cost > 0 then
      perform public._wallet_move(r.user_id, r.cost, 'refund', r.market_id, null,
        'Refund: market switched to pool betting');
    end if;
  end loop;
  delete from public.positions where market_id in (select id from public.markets where status = 'open');
  delete from public.trades where market_id in (select id from public.markets where status = 'open');
  update public.markets
     set engine = 'pool', stake_yes_kobo = 0, stake_no_kobo = 0, initial_prob = 0.5,
         pool_yes = 0, pool_no = 0, liquidity_kobo = 0, volume_kobo = 0, traders = 0
   where status in ('open', 'pending');
end $$;

-- ---------------------------------------------------------------------
-- Old fixed-odds functions are retired.
-- ---------------------------------------------------------------------
drop function if exists public.buy_shares(uuid, public.outcome, bigint, numeric);
drop function if exists public.sell_shares(uuid, public.outcome, numeric, bigint);
drop function if exists public.approve_market(uuid, numeric, bigint);

-- ---------------------------------------------------------------------
-- Place a bet into the pot.
-- ---------------------------------------------------------------------
create or replace function public.place_bet(p_market uuid, p_outcome public.outcome, p_amount_kobo bigint)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  v_bal bigint; v_new_trader boolean; v_yes bigint; v_no bigint;
begin
  if v_uid is null then raise exception 'Please log in to bet'; end if;
  select * into s from public.settings where id = 1;
  if p_amount_kobo is null or p_amount_kobo < s.min_trade_kobo then
    raise exception 'Minimum bet is ₦%', s.min_trade_kobo / 100;
  end if;

  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'This market is not open for betting'; end if;
  if m.closes_at <= now() then raise exception 'Betting has closed for this market'; end if;
  if m.engine <> 'pool' then raise exception 'This market is not open for betting'; end if;

  v_bal := public._wallet_move(v_uid, -p_amount_kobo, 'trade_buy', p_market, null,
    format('Bet %s on %s', public._naira(p_amount_kobo), p_outcome));

  select not exists (select 1 from public.positions where market_id = p_market and user_id = v_uid) into v_new_trader;

  v_yes := m.stake_yes_kobo + case when p_outcome = 'YES' then p_amount_kobo else 0 end;
  v_no := m.stake_no_kobo + case when p_outcome = 'NO' then p_amount_kobo else 0 end;
  update public.markets
     set stake_yes_kobo = v_yes, stake_no_kobo = v_no,
         volume_kobo = volume_kobo + p_amount_kobo,
         traders = traders + case when v_new_trader then 1 else 0 end
   where id = p_market;

  insert into public.positions (user_id, market_id, outcome, shares, cost_kobo)
  values (v_uid, p_market, p_outcome, 0, p_amount_kobo)
  on conflict (user_id, market_id, outcome) do update
    set cost_kobo = public.positions.cost_kobo + excluded.cost_kobo;

  insert into public.trades (market_id, user_id, side, outcome, amount_kobo, fee_kobo, shares, prob_yes_after)
  values (p_market, v_uid, 'buy', p_outcome, p_amount_kobo, 0, 0, v_yes::numeric / (v_yes + v_no));

  return json_build_object('amount_kobo', p_amount_kobo, 'balance_kobo', v_bal,
                           'stake_yes_kobo', v_yes, 'stake_no_kobo', v_no);
end $$;

-- ---------------------------------------------------------------------
-- Resolve: pay winners from the losing pot (never from UniPred's money).
-- ---------------------------------------------------------------------
create or replace function public.resolve_market(p_market uuid, p_outcome public.outcome)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.markets; s public.settings; r record;
  v_win bigint; v_lose bigint; v_pay bigint; v_total bigint := 0; v_winners int := 0; v_fee_total bigint := 0;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.settings where id = 1;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'Only open markets can be resolved'; end if;

  v_win := case when p_outcome = 'YES' then m.stake_yes_kobo else m.stake_no_kobo end;
  v_lose := case when p_outcome = 'YES' then m.stake_no_kobo else m.stake_yes_kobo end;

  if v_win = 0 then
    -- Nobody backed the winning side: refund everyone.
    for r in select user_id, cost_kobo from public.positions where market_id = p_market and cost_kobo > 0 order by user_id, outcome loop
      perform public._wallet_move(r.user_id, r.cost_kobo, 'refund', p_market, null,
        'Refund: nobody backed the winning side');
      v_total := v_total + r.cost_kobo;
    end loop;
  else
    for r in
      select user_id, cost_kobo from public.positions
       where market_id = p_market and outcome = p_outcome and cost_kobo > 0
       order by user_id
    loop
      v_pay := r.cost_kobo + floor((r.cost_kobo::numeric * v_lose * (10000 - s.pool_fee_bps)) / (10000::numeric * v_win))::bigint;
      perform public._wallet_move(r.user_id, v_pay, 'payout', p_market, null,
        format('Winnings: %s (market resolved %s)', public._naira(v_pay), p_outcome));
      v_total := v_total + v_pay;
      v_winners := v_winners + 1;
    end loop;
    v_fee_total := (v_win + v_lose) - v_total;
  end if;

  update public.markets set status = 'resolved', resolution = p_outcome, resolved_at = now() where id = p_market;
  return json_build_object('winners', v_winners, 'paid_kobo', v_total, 'fee_kobo', v_fee_total);
end $$;

-- ---------------------------------------------------------------------
-- Admin approval no longer needs odds or house money.
-- ---------------------------------------------------------------------
create or replace function public.approve_market(p_market uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.markets;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'pending' then raise exception 'Only pending markets can be approved'; end if;
  if m.closes_at <= now() then raise exception 'This market''s closing time has already passed'; end if;
  update public.markets
     set status = 'open', engine = 'pool', initial_prob = 0.5, approved_at = now(), admin_note = null
   where id = p_market;
end $$;

-- ---------------------------------------------------------------------
-- Proposals: same template + auto-approval, now with no pool funding.
-- ---------------------------------------------------------------------
create or replace function public.propose_market(
  p_school text, p_question text, p_category text, p_criteria text, p_source text, p_closes_at timestamptz
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  v_id uuid; v_recent int; v_auto_today int; v_rule text; v_question text; v_condition text;
begin
  if v_uid is null then raise exception 'Please log in to propose a market'; end if;
  select * into s from public.settings where id = 1;
  v_question := trim(p_question);
  v_condition := trim(trailing '.' from trim(p_criteria));

  if p_closes_at < now() + interval '1 hour' then raise exception 'Closing time must be at least 1 hour from now'; end if;
  if p_closes_at > now() + interval '120 days' then raise exception 'Closing time must be within 120 days'; end if;
  if char_length(v_condition) < 10 then raise exception 'Describe exactly what has to happen for YES'; end if;

  select count(*) into v_recent from public.markets
   where created_by = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= s.max_proposals_per_day then
    raise exception 'You can propose up to % markets per day. Try again tomorrow.', s.max_proposals_per_day;
  end if;

  if exists (select 1 from public.markets
              where school_id = p_school and status in ('pending', 'open')
                and lower(question) = lower(v_question)) then
    raise exception 'That market already exists at this university';
  end if;

  v_rule := format(
    'Resolves YES if %s, as confirmed by %s, on or before the closing time (%s, Lagos time). Resolves NO if this has not happened by then.',
    v_condition, trim(p_source), to_char(p_closes_at at time zone 'Africa/Lagos', 'DD Mon YYYY, HH24:MI'));

  insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by, engine)
  values (p_school, v_question, p_category, v_rule, trim(p_source), p_closes_at, v_uid, 'pool')
  returning id into v_id;

  select count(*) into v_auto_today from public.markets
   where auto_approved and approved_at > now() - interval '24 hours';

  if s.auto_approve and v_auto_today < s.auto_daily_cap then
    update public.markets set status = 'open', initial_prob = 0.5, approved_at = now(), auto_approved = true
     where id = v_id;
    return json_build_object('id', v_id, 'status', 'open');
  end if;
  return json_build_object('id', v_id, 'status', 'pending');
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public.place_bet(uuid, public.outcome, bigint) from public, anon;
grant execute on function public.place_bet(uuid, public.outcome, bigint) to authenticated;
revoke execute on function public.approve_market(uuid) from public, anon;
grant execute on function public.approve_market(uuid) to authenticated;          -- checks is_admin()
revoke execute on function public.resolve_market(uuid, public.outcome) from public, anon;
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated; -- checks is_admin()
