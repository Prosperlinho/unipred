-- =====================================================================
-- UniPred 0027: cash-out only opens halfway through a market's life
-- (halfway between going live and betting closing). Applies to pot and
-- house-liquidity markets. Run after 0025. Safe to run more than once.
-- =====================================================================

create or replace function public.cash_out_bet(p_market uuid, p_outcome public.outcome, p_percent int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  pos public.positions;
  v_amount bigint; v_fee bigint; v_back bigint; v_bal bigint; v_yes bigint; v_no bigint; v_r json; v_shares numeric; v_opens timestamptz;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if p_percent is null or p_percent < 1 or p_percent > 100 then raise exception 'Choose how much to cash out'; end if;
  -- Cash-out opens halfway between the market going live and betting closing.
  select coalesce(approved_at, created_at) + (closes_at - coalesce(approved_at, created_at)) / 2
    into v_opens from public.markets where id = p_market;
  if v_opens is not null and now() < v_opens then
    raise exception 'Cash-out opens at % (halfway to closing)', to_char(v_opens at time zone 'Africa/Lagos', 'DD Mon, HH24:MI');
  end if;
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

revoke execute on function public.cash_out_bet(uuid, public.outcome, int) from public, anon;
grant execute on function public.cash_out_bet(uuid, public.outcome, int) to authenticated;
