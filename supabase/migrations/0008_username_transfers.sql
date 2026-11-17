-- =====================================================================
-- 0008: send money to another member by username, with guardrails.
--   * both accounts: 7+ days old, verified own-name payout bank account,
--     House Rules accepted, not suspended
--   * only money WON on UniPred (payouts + invite bonuses) can be sent,
--     never fresh deposits or money received from others
--   * daily limits for sending and receiving
-- Run once, after 0001-0007.
-- =====================================================================

alter type public.ledger_kind add value if not exists 'transfer_out';
alter type public.ledger_kind add value if not exists 'transfer_in';

alter table public.settings
  add column if not exists p2p_enabled boolean not null default true,
  add column if not exists p2p_min_account_days int not null default 7,
  add column if not exists p2p_min_kobo bigint not null default 10000,                 -- N100
  add column if not exists p2p_daily_cap_kobo bigint not null default 1000000,         -- N10,000 sent per day
  add column if not exists p2p_daily_receive_cap_kobo bigint not null default 2000000; -- N20,000 received per day

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  note text check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists transfers_from_idx on public.transfers (from_user, created_at desc);
create index if not exists transfers_to_idx on public.transfers (to_user, created_at desc);

alter table public.transfers enable row level security;
drop policy if exists "read own transfers" on public.transfers;
create policy "read own transfers" on public.transfers for select
  using (from_user = auth.uid() or to_user = auth.uid());
revoke insert, update, delete on public.transfers from anon, authenticated;

-- ---------------------------------------------------------------------
-- How much a member may send right now, and why not if they can't.
-- ---------------------------------------------------------------------
create or replace function public._p2p_status(p_uid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings; p public.profiles; v_bal bigint; v_earned bigint; v_sent_total bigint;
  v_sent_today bigint; v_sendable bigint; v_reason text := null;
begin
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = p_uid;
  select balance_kobo into v_bal from public.wallets where user_id = p_uid;

  select coalesce(sum(amount_kobo), 0) into v_earned from public.ledger
   where user_id = p_uid and kind in ('payout', 'referral');
  select coalesce(sum(-amount_kobo), 0) into v_sent_total from public.ledger
   where user_id = p_uid and kind = 'transfer_out';
  select coalesce(sum(amount_kobo), 0) into v_sent_today from public.transfers
   where from_user = p_uid and created_at > now() - interval '24 hours';

  v_sendable := greatest(0, least(coalesce(v_bal, 0), v_earned - v_sent_total, s.p2p_daily_cap_kobo - v_sent_today));

  if not s.p2p_enabled then v_reason := 'Sending money is switched off right now.';
  elsif p.is_banned then v_reason := 'Your account is suspended.';
  elsif p.terms_accepted_at is null then v_reason := 'Accept the House Rules first.';
  elsif p.created_at > now() - make_interval(days => s.p2p_min_account_days) then
    v_reason := format('Your account must be at least %s days old to send money.', s.p2p_min_account_days);
  elsif not exists (select 1 from public.payout_accounts where user_id = p_uid) then
    v_reason := 'Add a payout bank account in your own name (Settings) to send money.';
  elsif v_earned - v_sent_total <= 0 then
    v_reason := 'You can only send money you''ve won on UniPred. Win a market first.';
  elsif s.p2p_daily_cap_kobo - v_sent_today <= 0 then
    v_reason := 'You''ve reached today''s sending limit.';
  end if;

  return json_build_object(
    'eligible', v_reason is null,
    'reason', v_reason,
    'sendable_kobo', case when v_reason is null then v_sendable else 0 end,
    'sent_today_kobo', v_sent_today,
    'daily_cap_kobo', s.p2p_daily_cap_kobo,
    'min_kobo', s.p2p_min_kobo);
end $$;

create or replace function public.my_p2p_status()
returns json language sql stable security definer set search_path = public as $$
  select public._p2p_status(auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Send money to a username.
-- ---------------------------------------------------------------------
create or replace function public.send_money(p_username text, p_amount_kobo bigint, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings; st json; r public.profiles;
  v_received_today bigint; v_id uuid; v_from_name text; v_bal bigint; v_note text;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  select * into s from public.settings where id = 1;

  select * into r from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'No UniPred member with that username'; end if;
  if r.id = v_uid then raise exception 'You can''t send money to yourself'; end if;

  -- Lock both wallets in a fixed order so two people sending to each other can't deadlock.
  perform 1 from public.wallets where user_id in (v_uid, r.id) order by user_id for update;

  st := public._p2p_status(v_uid);
  if not (st ->> 'eligible')::boolean then raise exception '%', st ->> 'reason'; end if;
  if p_amount_kobo is null or p_amount_kobo < s.p2p_min_kobo then
    raise exception 'Minimum transfer is %', public._naira(s.p2p_min_kobo);
  end if;
  if p_amount_kobo > (st ->> 'sendable_kobo')::bigint then
    raise exception 'You can send up to % right now', public._naira((st ->> 'sendable_kobo')::bigint);
  end if;

  if r.is_banned or r.terms_accepted_at is null
     or r.created_at > now() - make_interval(days => s.p2p_min_account_days)
     or not exists (select 1 from public.payout_accounts where user_id = r.id) then
    raise exception '@% can''t receive money yet. They need an account at least % days old with a verified bank account in their own name.',
      r.username, s.p2p_min_account_days;
  end if;

  select coalesce(sum(amount_kobo), 0) into v_received_today from public.transfers
   where to_user = r.id and created_at > now() - interval '24 hours';
  if v_received_today + p_amount_kobo > s.p2p_daily_receive_cap_kobo then
    raise exception '@% can''t receive that much today', r.username;
  end if;

  v_note := nullif(left(trim(coalesce(p_note, '')), 80), '');
  select username into v_from_name from public.profiles where id = v_uid;
  insert into public.transfers (from_user, to_user, amount_kobo, note)
  values (v_uid, r.id, p_amount_kobo, v_note) returning id into v_id;

  v_bal := public._wallet_move(v_uid, -p_amount_kobo, 'transfer_out', null, v_id::text,
    format('Sent %s to @%s%s', public._naira(p_amount_kobo), r.username, coalesce(' · ' || v_note, '')));
  perform public._wallet_move(r.id, p_amount_kobo, 'transfer_in', null, v_id::text,
    format('Received %s from @%s%s', public._naira(p_amount_kobo), v_from_name, coalesce(' · ' || v_note, '')));

  return json_build_object('id', v_id, 'amount_kobo', p_amount_kobo, 'to', r.username, 'balance_kobo', v_bal);
end $$;

revoke execute on function public._p2p_status(uuid) from public, anon, authenticated;
revoke execute on function public.my_p2p_status() from public, anon;
grant execute on function public.my_p2p_status() to authenticated;
revoke execute on function public.send_money(text, bigint, text) from public, anon;
grant execute on function public.send_money(text, bigint, text) to authenticated;
