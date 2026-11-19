-- =====================================================================
-- UniPred 0025: house liquidity (test mode) - odds move with every bet and
-- members can cash out any time at the live price, like a normal bookmaker.
--   * New markets use the liquidity engine ('amm') while
--     settings.market_engine = 'amm'. UniPred seeds each one with
--     settings.amm_liquidity_kobo (default ₦100,000 of test money) at 50/50.
--   * Buying: each ₦100 buys YES/NO shares at the current price
--     (trade fee = settings.trade_fee_bps). A winning share pays ₦100.
--   * Cash out: sell shares back at the current price - can be a profit
--     or a loss. (Pool markets keep the flat exit fee.)
--   * Existing pool markets keep working exactly as before.
--   To switch back to pot betting for new markets:
--     update public.settings set market_engine = 'pool' where id = 1;
-- Run after 0024. Safe to run more than once.
-- =====================================================================

alter table public.settings
  add column if not exists market_engine text not null default 'amm' check (market_engine in ('pool', 'amm')),
  add column if not exists amm_liquidity_kobo bigint not null default 10000000 check (amm_liquidity_kobo >= 100000);

-- Every new market picks up the current engine and, for 'amm', its seed liquidity at 50/50.
create or replace function public._apply_market_engine()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.settings; v_l numeric;
begin
  select * into s from public.settings where id = 1;
  if s.market_engine = 'amm' then
    v_l := s.amm_liquidity_kobo::numeric / 10000;   -- shares on each side at 50%
    new.engine := 'amm';
    new.liquidity_kobo := s.amm_liquidity_kobo;
    new.pool_yes := v_l;
    new.pool_no := v_l;
    new.initial_prob := 0.5;
  end if;
  return new;
end $$;

drop trigger if exists markets_apply_engine on public.markets;
create trigger markets_apply_engine before insert on public.markets
  for each row execute function public._apply_market_engine();

-- Share trading (restored from 0004; called only from place_bet / cash_out_bet).
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

create or replace function public.place_bet(p_market uuid, p_outcome public.outcome, p_amount_kobo bigint)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  v_bal bigint; v_new_trader boolean; v_yes bigint; v_no bigint; v_r json;
begin
  if v_uid is null then raise exception 'Please log in to bet'; end if;
  -- House-liquidity markets: buy shares at the live price.
  if exists (select 1 from public.markets where id = p_market and engine = 'amm') then
    v_r := public.buy_shares(p_market, p_outcome, p_amount_kobo, 0);
    return json_build_object('amount_kobo', p_amount_kobo, 'balance_kobo', (v_r ->> 'balance_kobo')::bigint,
                             'stake_yes_kobo', 0, 'stake_no_kobo', 0, 'shares', (v_r ->> 'shares')::numeric,
                             'prob_yes', (v_r ->> 'prob_yes')::numeric);
  end if;
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

create or replace function public.cash_out_bet(p_market uuid, p_outcome public.outcome, p_percent int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  pos public.positions;
  v_amount bigint; v_fee bigint; v_back bigint; v_bal bigint; v_yes bigint; v_no bigint; v_r json; v_shares numeric;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if p_percent is null or p_percent < 1 or p_percent > 100 then raise exception 'Choose how much to cash out'; end if;
  -- House-liquidity markets: sell shares back at the live price.
  if exists (select 1 from public.markets where id = p_market and engine = 'amm') then
    select shares into v_shares from public.positions where user_id = v_uid and market_id = p_market and outcome = p_outcome;
    if v_shares is null or v_shares <= 0 then raise exception 'You have no % bet on this market', p_outcome; end if;
    v_r := public.sell_shares(p_market, p_outcome, case when p_percent = 100 then v_shares else v_shares * p_percent / 100.0 end, 0);
    return json_build_object('returned_kobo', (v_r ->> 'amount_kobo')::bigint, 'fee_kobo', (v_r ->> 'fee_kobo')::bigint,
                             'balance_kobo', (v_r ->> 'balance_kobo')::bigint);
  end if;
  select * into s from public.settings where id = 1;

  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' or m.engine <> 'pool' then raise exception 'This market is not open'; end if;
  if m.closes_at <= now() then raise exception 'Betting has closed, so this bet can no longer be cashed out'; end if;

  select * into pos from public.positions
   where user_id = v_uid and market_id = p_market and outcome = p_outcome for update;
  if not found or pos.cost_kobo <= 0 then raise exception 'You have no % bet on this market', p_outcome; end if;

  v_amount := case when p_percent = 100 then pos.cost_kobo else floor(pos.cost_kobo * p_percent / 100.0)::bigint end;
  if v_amount < 100 then raise exception 'That amount is too small to cash out'; end if;
  v_fee := (v_amount * s.exit_fee_bps) / 10000;
  v_back := v_amount - v_fee;

  -- Take the money out of the pot (the guard trigger blocks suspended accounts here).
  if v_amount >= pos.cost_kobo then
    update public.positions set cost_kobo = 0 where user_id = v_uid and market_id = p_market and outcome = p_outcome;
    delete from public.positions where user_id = v_uid and market_id = p_market and outcome = p_outcome;
  else
    update public.positions set cost_kobo = cost_kobo - v_amount
     where user_id = v_uid and market_id = p_market and outcome = p_outcome;
  end if;

  v_yes := m.stake_yes_kobo - case when p_outcome = 'YES' then v_amount else 0 end;
  v_no := m.stake_no_kobo - case when p_outcome = 'NO' then v_amount else 0 end;
  update public.markets set stake_yes_kobo = v_yes, stake_no_kobo = v_no where id = p_market;

  v_bal := public._wallet_move(v_uid, v_back, 'trade_sell', p_market, null,
    format('Cashed out %s from %s (%s exit fee)', public._naira(v_back), p_outcome, public._naira(v_fee)));

  insert into public.trades (market_id, user_id, side, outcome, amount_kobo, fee_kobo, shares, prob_yes_after)
  values (p_market, v_uid, 'sell', p_outcome, v_back, v_fee, 0,
          case when v_yes + v_no > 0 then v_yes::numeric / (v_yes + v_no) else 0.5 end);

  return json_build_object('returned_kobo', v_back, 'fee_kobo', v_fee, 'balance_kobo', v_bal,
                           'stake_yes_kobo', v_yes, 'stake_no_kobo', v_no);
end $$;

create or replace function public.resolve_market(p_market uuid, p_outcome public.outcome)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.markets; s public.settings; r record;
  v_win bigint; v_lose bigint; v_pay bigint; v_bonus bigint;
  v_total bigint := 0; v_winners int := 0; v_fee bigint := 0; v_ref_total bigint := 0;
begin
  -- UniPred admins, or the host of the room this question belongs to.
  if not (public.is_admin() or exists (select 1 from public.markets mm join public.rooms host_room on host_room.id = mm.room_id
                 where mm.id = p_market and host_room.owner_id = auth.uid() and not host_room.suspended)) then raise exception 'Only the room host or an admin can decide this result'; end if;
  select * into s from public.settings where id = 1;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'Only open markets can be resolved'; end if;

  if m.engine = 'amm' then
    for r in select user_id, shares from public.positions
              where market_id = p_market and outcome = p_outcome and shares > 0 order by user_id loop
      v_pay := floor(r.shares * 10000)::bigint;
      if v_pay > 0 then
        perform public._wallet_move(r.user_id, v_pay, 'payout', p_market, null,
          format('Winnings: %s (market resolved %s)', public._naira(v_pay), p_outcome));
        v_total := v_total + v_pay;
        v_winners := v_winners + 1;
      end if;
    end loop;
    update public.markets set status = 'resolved', resolution = p_outcome, resolved_at = now() where id = p_market;
    return json_build_object('winners', v_winners, 'paid_kobo', v_total, 'fee_kobo', 0, 'referral_kobo', 0);
  end if;

  v_win := case when p_outcome = 'YES' then m.stake_yes_kobo else m.stake_no_kobo end;
  v_lose := case when p_outcome = 'YES' then m.stake_no_kobo else m.stake_yes_kobo end;

  if v_win = 0 then
    for r in select user_id, cost_kobo from public.positions
              where market_id = p_market and cost_kobo > 0 order by user_id, outcome loop
      perform public._wallet_move(r.user_id, r.cost_kobo, 'refund', p_market, null,
        'Refund: nobody backed the winning side');
      v_total := v_total + r.cost_kobo;
    end loop;
  else
    for r in select user_id, cost_kobo from public.positions
              where market_id = p_market and outcome = p_outcome and cost_kobo > 0 order by user_id loop
      v_pay := r.cost_kobo + floor((r.cost_kobo::numeric * v_lose * (10000 - s.pool_fee_bps)) / (10000::numeric * v_win))::bigint;
      perform public._wallet_move(r.user_id, v_pay, 'payout', p_market, null,
        format('Winnings: %s (market resolved %s)', public._naira(v_pay), p_outcome));
      v_total := v_total + v_pay;
      v_winners := v_winners + 1;
    end loop;
    v_fee := (v_win + v_lose) - v_total;

    if v_fee > 0 then
      for r in
        select inv.referred_by as referrer,
               coalesce(ref.referral_bps_override, s.referral_share_bps) as rate,
               sum(p.cost_kobo)::bigint as staked
          from public.positions p
          join public.profiles inv on inv.id = p.user_id
          join public.profiles ref on ref.id = inv.referred_by
         where p.market_id = p_market and p.cost_kobo > 0 and not ref.is_banned
           and public._referral_qualified(inv.id)
         group by inv.referred_by, ref.referral_bps_override
         order by inv.referred_by
      loop
        v_bonus := floor((v_fee::numeric * r.staked * r.rate) / ((v_win + v_lose)::numeric * 10000))::bigint;
        -- Never pay out more than the fee in total, whatever the rates.
        v_bonus := least(v_bonus, v_fee - v_ref_total);
        if v_bonus > 0 then
          perform public._wallet_move(r.referrer, v_bonus, 'referral', p_market, null,
            format('Invite bonus: %s from your friends'' bets', public._naira(v_bonus)));
          v_ref_total := v_ref_total + v_bonus;
        end if;
      end loop;
    end if;
  end if;

  update public.markets set status = 'resolved', resolution = p_outcome, resolved_at = now() where id = p_market;
  return json_build_object('winners', v_winners, 'paid_kobo', v_total,
                           'fee_kobo', v_fee - v_ref_total, 'referral_kobo', v_ref_total);
end $$;

revoke execute on function public.buy_shares(uuid, public.outcome, bigint, numeric) from public, anon, authenticated;
revoke execute on function public.sell_shares(uuid, public.outcome, numeric, bigint) from public, anon, authenticated;
revoke execute on function public.place_bet(uuid, public.outcome, bigint) from public, anon;
grant execute on function public.place_bet(uuid, public.outcome, bigint) to authenticated;
revoke execute on function public.cash_out_bet(uuid, public.outcome, int) from public, anon;
grant execute on function public.cash_out_bet(uuid, public.outcome, int) to authenticated;
revoke execute on function public.resolve_market(uuid, public.outcome) from public, anon;
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated;
