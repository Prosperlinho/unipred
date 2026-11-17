-- =====================================================================
-- UniPred 0009: sending money to members.
--   * any wallet money can be sent (no longer limited to winnings);
--   * the sender must have placed at least 3 bets.
-- The 0008 rules stay: account 7+ days old, verified own-name bank account
-- (one bank account per UniPred account), daily limits.
-- Run after 0008. Safe to run more than once.
-- =====================================================================

alter table public.settings
  add column if not exists p2p_min_bets int not null default 3;

create or replace function public._bet_count(p_uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.trades where user_id = p_uid and side = 'buy';
$$;

create or replace function public._p2p_status(p_uid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings; p public.profiles; v_bal bigint;
  v_sent_today bigint; v_sendable bigint; v_reason text := null; v_bets int;
begin
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = p_uid;
  select balance_kobo into v_bal from public.wallets where user_id = p_uid;
  v_bets := public._bet_count(p_uid);

  select coalesce(sum(amount_kobo), 0) into v_sent_today from public.transfers
   where from_user = p_uid and created_at > now() - interval '24 hours';

  v_sendable := greatest(0, least(coalesce(v_bal, 0), s.p2p_daily_cap_kobo - v_sent_today));

  if not s.p2p_enabled then v_reason := 'Sending money is switched off right now.';
  elsif p.is_banned then v_reason := 'Your account is suspended.';
  elsif p.terms_accepted_at is null then v_reason := 'Accept the House Rules first.';
  elsif p.created_at > now() - make_interval(days => s.p2p_min_account_days) then
    v_reason := format('Your account must be at least %s days old to send money.', s.p2p_min_account_days);
  elsif v_bets < s.p2p_min_bets then
    v_reason := format('Place at least %s bets before sending money (you''ve placed %s).', s.p2p_min_bets, v_bets);
  elsif not exists (select 1 from public.payout_accounts where user_id = p_uid) then
    v_reason := 'Add a payout bank account in your own name (Settings) to send money.';
  elsif s.p2p_daily_cap_kobo - v_sent_today <= 0 then
    v_reason := 'You''ve reached today''s sending limit.';
  elsif coalesce(v_bal, 0) <= 0 then
    v_reason := 'Your wallet is empty.';
  end if;

  return json_build_object(
    'eligible', v_reason is null,
    'reason', v_reason,
    'sendable_kobo', case when v_reason is null then v_sendable else 0 end,
    'sent_today_kobo', v_sent_today,
    'daily_cap_kobo', s.p2p_daily_cap_kobo,
    'min_kobo', s.p2p_min_kobo);
end $$;

revoke execute on function public._bet_count(uuid) from public, anon, authenticated;
revoke execute on function public._p2p_status(uuid) from public, anon, authenticated;
