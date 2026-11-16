-- =====================================================================
-- 0007: early cash-out for pool bets.
-- Before betting closes, a member can take part or all of their stake back
-- out of the pot, minus an exit fee kept by UniPred. They can never get back
-- more than they staked, so UniPred takes no risk. Run once, after 0001-0006.
-- =====================================================================

alter table public.settings
  add column if not exists exit_fee_bps int not null default 1500 check (exit_fee_bps between 0 and 5000); -- 15%

create or replace function public.cash_out_bet(p_market uuid, p_outcome public.outcome, p_percent int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  m public.markets;
  pos public.positions;
  v_amount bigint; v_fee bigint; v_back bigint; v_bal bigint; v_yes bigint; v_no bigint;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if p_percent is null or p_percent < 1 or p_percent > 100 then raise exception 'Choose how much to cash out'; end if;
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
