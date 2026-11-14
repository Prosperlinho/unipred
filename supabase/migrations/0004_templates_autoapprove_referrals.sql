-- =====================================================================
-- 0004: template proposals with auto-approval, naira-first wording,
--       referral tracking. Safe to run once on top of 0001-0003.
-- =====================================================================

-- ---- Settings for auto-approval and spam limits ------------------------
alter table public.settings
  add column if not exists auto_approve boolean not null default true,
  add column if not exists auto_liquidity_kobo bigint not null default 500000,   -- ₦5,000 pool per auto market
  add column if not exists auto_daily_cap int not null default 30,               -- max auto-approved markets per 24h (all users)
  add column if not exists max_proposals_per_day int not null default 3;         -- per user

alter table public.markets
  add column if not exists auto_approved boolean not null default false;

-- ---- Referrals -------------------------------------------------------------
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

create or replace function public.referral_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles where referred_by = auth.uid();
$$;

-- ---- Naira formatting for ledger descriptions -----------------------------
create or replace function public._naira(p_kobo bigint)
returns text language sql immutable as $$
  select '₦' || case when p_kobo % 100 = 0
    then to_char(p_kobo / 100, 'FM999,999,999,990')
    else to_char(p_kobo / 100.0, 'FM999,999,999,990.00') end;
$$;

-- ---- Updated functions (same logic, naira wording) -----------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dob date; v_ref uuid;
begin
  v_dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  if v_dob is null or v_dob > (current_date - interval '18 years') then
    raise exception 'You must be at least 18 years old to use UniPred';
  end if;
  insert into public.profiles (id, username, full_name, school_id, date_of_birth)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'school_id',
    v_dob
  );
  insert into public.wallets (user_id) values (new.id);
  -- Referral: link to the inviter if a valid username was passed.
  select id into v_ref from public.profiles
   where lower(username) = lower(new.raw_user_meta_data ->> 'ref') and id <> new.id;
  if v_ref is not null then
    update public.profiles set referred_by = v_ref where id = new.id;
  end if;
  return new;
end $$;

create or replace function public.buy_shares(
  p_market uuid, p_outcome public.outcome, p_amount_kobo bigint, p_min_shares numeric default 0
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  v_fee bigint; v_sets numeric; v_k numeric;
  v_yes numeric; v_no numeric; v_shares numeric; v_prob numeric; v_bal bigint;
  v_new_trader boolean;
begin
  if v_uid is null then raise exception 'Please log in to trade'; end if;
  select * into s from public.settings where id = 1;
  if p_amount_kobo is null or p_amount_kobo < s.min_trade_kobo then
    raise exception 'Minimum stake is ₦%', s.min_trade_kobo / 100;
  end if;

  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'This market is not open for trading'; end if;
  if m.closes_at <= now() then raise exception 'Trading has closed for this market'; end if;

  v_fee := (p_amount_kobo * s.trade_fee_bps) / 10000;
  v_sets := (p_amount_kobo - v_fee)::numeric / 10000;
  v_k := m.pool_yes * m.pool_no;
  if p_outcome = 'YES' then
    v_no := m.pool_no + v_sets;
    v_yes := v_k / v_no;
    v_shares := m.pool_yes + v_sets - v_yes;
  else
    v_yes := m.pool_yes + v_sets;
    v_no := v_k / v_yes;
    v_shares := m.pool_no + v_sets - v_no;
  end if;
  if v_shares <= 0 or v_shares < coalesce(p_min_shares, 0) then
    raise exception 'The price moved before your trade went through. Please try again.';
  end if;
  v_prob := v_no / (v_yes + v_no);

  v_bal := public._wallet_move(v_uid, -p_amount_kobo, 'trade_buy', p_market, null,
    format('Staked %s on %s (pays %s if %s wins)', public._naira(p_amount_kobo), p_outcome, public._naira(floor(v_shares * 10000)::bigint), p_outcome));

  select not exists (select 1 from public.trades where market_id = p_market and user_id = v_uid) into v_new_trader;
  update public.markets
     set pool_yes = v_yes, pool_no = v_no,
         volume_kobo = volume_kobo + p_amount_kobo,
         traders = traders + case when v_new_trader then 1 else 0 end
   where id = p_market;

  insert into public.positions (user_id, market_id, outcome, shares, cost_kobo)
  values (v_uid, p_market, p_outcome, v_shares, p_amount_kobo)
  on conflict (user_id, market_id, outcome) do update
    set shares = public.positions.shares + excluded.shares,
        cost_kobo = public.positions.cost_kobo + excluded.cost_kobo;

  insert into public.trades (market_id, user_id, side, outcome, amount_kobo, fee_kobo, shares, prob_yes_after)
  values (p_market, v_uid, 'buy', p_outcome, p_amount_kobo, v_fee, v_shares, v_prob);

  return json_build_object('shares', v_shares, 'amount_kobo', p_amount_kobo, 'fee_kobo', v_fee,
                           'prob_yes', v_prob, 'balance_kobo', v_bal);
end $$;

create or replace function public.sell_shares(
  p_market uuid, p_outcome public.outcome, p_shares numeric, p_min_kobo bigint default 0
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  pos public.positions;
  v_sell numeric; v_own numeric; v_other numeric; v_b numeric; v_c numeric; v_sets numeric;
  v_gross bigint; v_fee bigint; v_net bigint; v_cost_removed bigint;
  v_yes numeric; v_no numeric; v_prob numeric; v_bal bigint;
begin
  if v_uid is null then raise exception 'Please log in to trade'; end if;
  select * into s from public.settings where id = 1;

  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'This market is not open for trading'; end if;
  if m.closes_at <= now() then raise exception 'Trading has closed for this market'; end if;

  select * into pos from public.positions
   where user_id = v_uid and market_id = p_market and outcome = p_outcome for update;
  if not found or p_shares is null or p_shares <= 0 or p_shares > pos.shares + 0.000001 then
    raise exception 'You do not hold enough % shares', p_outcome;
  end if;
  v_sell := least(p_shares, pos.shares);

  if p_outcome = 'YES' then v_own := m.pool_yes; v_other := m.pool_no;
  else v_own := m.pool_no; v_other := m.pool_yes; end if;

  -- Solve (own + s - a)(other - a) = own * other for a (stable root).
  v_b := v_own + v_sell + v_other;
  v_c := v_sell * v_other;
  v_sets := (2 * v_c) / (v_b + sqrt(v_b * v_b - 4 * v_c));

  v_gross := floor(v_sets * 10000);
  v_fee := (v_gross * s.trade_fee_bps) / 10000;
  v_net := v_gross - v_fee;
  if v_net <= 0 or v_net < coalesce(p_min_kobo, 0) then
    raise exception 'The price moved before your trade went through. Please try again.';
  end if;

  if p_outcome = 'YES' then
    v_yes := v_own + v_sell - v_sets; v_no := v_other - v_sets;
  else
    v_no := v_own + v_sell - v_sets; v_yes := v_other - v_sets;
  end if;
  v_prob := v_no / (v_yes + v_no);

  v_cost_removed := round(pos.cost_kobo * (v_sell / pos.shares));
  if pos.shares - v_sell < 0.000001 then
    delete from public.positions where user_id = v_uid and market_id = p_market and outcome = p_outcome;
  else
    update public.positions
       set shares = shares - v_sell, cost_kobo = greatest(0, cost_kobo - v_cost_removed)
     where user_id = v_uid and market_id = p_market and outcome = p_outcome;
  end if;

  update public.markets
     set pool_yes = v_yes, pool_no = v_no, volume_kobo = volume_kobo + v_gross
   where id = p_market;

  v_bal := public._wallet_move(v_uid, v_net, 'trade_sell', p_market, null,
    format('Cashed out %s from %s', public._naira(v_net), p_outcome));

  insert into public.trades (market_id, user_id, side, outcome, amount_kobo, fee_kobo, shares, prob_yes_after)
  values (p_market, v_uid, 'sell', p_outcome, v_net, v_fee, v_sell, v_prob);

  return json_build_object('shares', v_sell, 'amount_kobo', v_net, 'fee_kobo', v_fee,
                           'prob_yes', v_prob, 'balance_kobo', v_bal);
end $$;

create or replace function public.resolve_market(p_market uuid, p_outcome public.outcome)
returns json language plpgsql security definer set search_path = public as $$
declare m public.markets; r record; v_pay bigint; v_total bigint := 0; v_winners int := 0;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'Only open markets can be resolved'; end if;

  for r in
    select user_id, shares from public.positions
     where market_id = p_market and outcome = p_outcome and shares > 0
     order by user_id
  loop
    v_pay := floor(r.shares * 10000);
    if v_pay > 0 then
      perform public._wallet_move(r.user_id, v_pay, 'payout', p_market, null,
        format('Winnings: market resolved %s', p_outcome));
      v_total := v_total + v_pay;
      v_winners := v_winners + 1;
    end if;
  end loop;

  update public.markets set status = 'resolved', resolution = p_outcome, resolved_at = now() where id = p_market;
  return json_build_object('winners', v_winners, 'paid_kobo', v_total);
end $$;

-- ---- Template proposals with automatic approval -----------------------------------
-- p_criteria is the YES condition, e.g. "Engineering wins the VC Cup semi-final".
-- The full rule is built here so every market follows the same resolvable format.
drop function if exists public.propose_market(text, text, text, text, text, timestamptz);
create function public.propose_market(
  p_school text, p_question text, p_category text, p_criteria text, p_source text, p_closes_at timestamptz
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  v_id uuid; v_recent int; v_auto_today int; v_rule text; v_question text; v_condition text; v_l numeric;
begin
  if v_uid is null then raise exception 'Please log in to propose a market'; end if;
  select * into s from public.settings where id = 1;
  v_question := trim(p_question);
  v_condition := trim(trailing '.' from trim(p_criteria));

  if p_closes_at < now() + interval '1 hour' then
    raise exception 'Closing time must be at least 1 hour from now';
  end if;
  if p_closes_at > now() + interval '120 days' then
    raise exception 'Closing time must be within 120 days';
  end if;
  if char_length(v_condition) < 10 then
    raise exception 'Describe exactly what has to happen for YES';
  end if;

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

  insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by)
  values (p_school, v_question, p_category, v_rule, trim(p_source), p_closes_at, v_uid)
  returning id into v_id;

  select count(*) into v_auto_today from public.markets
   where auto_approved and approved_at > now() - interval '24 hours';

  if s.auto_approve and v_auto_today < s.auto_daily_cap then
    v_l := s.auto_liquidity_kobo::numeric / 10000;
    update public.markets
       set status = 'open', initial_prob = 0.5, pool_yes = v_l, pool_no = v_l,
           liquidity_kobo = s.auto_liquidity_kobo, approved_at = now(), auto_approved = true
     where id = v_id;
    return json_build_object('id', v_id, 'status', 'open');
  end if;
  return json_build_object('id', v_id, 'status', 'pending');
end $$;

-- ---- Permissions -------------------------------------------------------------------
revoke execute on function public._naira(bigint) from public, anon, authenticated;
revoke execute on function public.propose_market(text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.propose_market(text, text, text, text, text, timestamptz) to authenticated;
revoke execute on function public.referral_count() from public, anon;
grant execute on function public.referral_count() to authenticated;
