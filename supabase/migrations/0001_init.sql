-- =====================================================================
-- UniPred database schema
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Money is stored in KOBO (1 naira = 100 kobo) as bigint.
-- One winning share pays out SHARE_VALUE = 10,000 kobo (N100).
-- All balance changes happen inside the SECURITY DEFINER functions below,
-- with row locks, so concurrent requests can never double-spend.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.market_status as enum ('pending', 'open', 'resolved', 'rejected', 'cancelled');
create type public.outcome as enum ('YES', 'NO');
create type public.ledger_kind as enum (
  'deposit', 'withdrawal', 'withdrawal_refund', 'trade_buy', 'trade_sell', 'payout', 'refund', 'adjustment'
);
create type public.deposit_status as enum ('pending', 'success', 'failed');
create type public.withdrawal_status as enum ('pending', 'processing', 'paid', 'rejected', 'failed');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.schools (
  id text primary key,
  name text not null,
  short_name text not null,
  state text not null,
  ownership text not null check (ownership in ('Federal', 'State', 'Private'))
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  trade_fee_bps int not null default 200 check (trade_fee_bps between 0 and 1000), -- 200 = 2%
  min_trade_kobo bigint not null default 10000,        -- N100
  min_deposit_kobo bigint not null default 10000,      -- N100
  min_withdrawal_kobo bigint not null default 100000,  -- N1,000
  max_pending_proposals int not null default 5
);
insert into public.settings (id) values (1);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  full_name text not null default '' check (char_length(full_name) <= 80),
  school_id text not null references public.schools (id),
  date_of_birth date not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table public.payout_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  account_name text not null,
  recipient_code text not null,
  updated_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id),
  question text not null check (char_length(question) between 12 and 160),
  category text not null check (category in ('Campus Politics', 'Academics', 'Sports', 'Events & Lifestyle')),
  criteria text not null check (char_length(criteria) between 15 and 800),
  source text not null check (char_length(source) between 2 and 200),
  closes_at timestamptz not null,
  status public.market_status not null default 'pending',
  resolution public.outcome,
  initial_prob numeric not null default 0.5,
  pool_yes numeric not null default 0,
  pool_no numeric not null default 0,
  liquidity_kobo bigint not null default 0,
  volume_kobo bigint not null default 0,
  traders int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  resolved_at timestamptz
);
create index markets_school_status_idx on public.markets (school_id, status);
create index markets_status_closes_idx on public.markets (status, closes_at);

create table public.positions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  outcome public.outcome not null,
  shares numeric not null default 0 check (shares >= 0),
  cost_kobo bigint not null default 0,
  primary key (user_id, market_id, outcome)
);
create index positions_market_idx on public.positions (market_id);

create table public.trades (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  side text not null check (side in ('buy', 'sell')),
  outcome public.outcome not null,
  amount_kobo bigint not null,   -- what the user paid (buy) or received (sell)
  fee_kobo bigint not null default 0,
  shares numeric not null,
  prob_yes_after numeric not null,
  created_at timestamptz not null default now()
);
create index trades_market_time_idx on public.trades (market_id, created_at);
create index trades_user_idx on public.trades (user_id, created_at desc);

create table public.comments (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  side public.outcome,
  created_at timestamptz not null default now()
);
create index comments_market_idx on public.comments (market_id, created_at desc);

create table public.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.ledger_kind not null,
  amount_kobo bigint not null,          -- signed: + credit, - debit
  balance_after_kobo bigint not null,
  market_id uuid references public.markets (id) on delete set null,
  reference text,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index ledger_user_idx on public.ledger (user_id, created_at desc);

create table public.deposits (
  reference text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  status public.deposit_status not null default 'pending',
  channel text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index deposits_user_idx on public.deposits (user_id, created_at desc);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  recipient_code text not null,
  status public.withdrawal_status not null default 'pending',
  transfer_code text,
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index withdrawals_user_idx on public.withdrawals (user_id, created_at desc);
create index withdrawals_status_idx on public.withdrawals (status, created_at);

-- Public-safe views (no date of birth, no wallet data)
create view public.public_profiles as
  select id, username, school_id, created_at from public.profiles;

create view public.market_history as
  select market_id, prob_yes_after as p, created_at as t from public.trades;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.markets enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
alter table public.comments enable row level security;
alter table public.ledger enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;

create policy "schools are public" on public.schools for select using (true);
create policy "settings are public" on public.settings for select using (true);

create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "read own wallet" on public.wallets for select using (user_id = auth.uid());
create policy "read own payout account" on public.payout_accounts for select using (user_id = auth.uid());
create policy "read own positions" on public.positions for select using (user_id = auth.uid());
create policy "read own trades" on public.trades for select using (user_id = auth.uid());
create policy "read own ledger" on public.ledger for select using (user_id = auth.uid());
create policy "read own deposits" on public.deposits for select using (user_id = auth.uid());
create policy "read own withdrawals" on public.withdrawals for select using (user_id = auth.uid());

create policy "read live markets or own proposals" on public.markets for select
  using (status in ('open', 'resolved', 'cancelled') or created_by = auth.uid());

create policy "comments are public" on public.comments for select using (true);
create policy "post own comments" on public.comments for insert to authenticated
  with check (user_id = auth.uid());
create policy "delete own comments" on public.comments for delete to authenticated
  using (user_id = auth.uid());

grant select on public.public_profiles to anon, authenticated;
grant select on public.market_history to anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Internal: move money in/out of a wallet and write the ledger row.
create or replace function public._wallet_move(
  p_user uuid, p_amount bigint, p_kind public.ledger_kind,
  p_market uuid, p_reference text, p_description text
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  update public.wallets
     set balance_kobo = balance_kobo + p_amount, updated_at = now()
   where user_id = p_user and balance_kobo + p_amount >= 0
  returning balance_kobo into v_bal;
  if not found then
    raise exception 'Insufficient wallet balance';
  end if;
  insert into public.ledger (user_id, kind, amount_kobo, balance_after_kobo, market_id, reference, description)
  values (p_user, p_kind, p_amount, v_bal, p_market, p_reference, p_description);
  return v_bal;
end $$;

-- ---------------------------------------------------------------------
-- Sign-up: create profile + wallet from the metadata sent by the app
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dob date;
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
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Trading (constant-product AMM, x * y = k)
-- ---------------------------------------------------------------------
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
    format('Bought %s %s shares', round(v_shares, 2), p_outcome));

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
    format('Sold %s %s shares', round(v_sell, 2), p_outcome));

  insert into public.trades (market_id, user_id, side, outcome, amount_kobo, fee_kobo, shares, prob_yes_after)
  values (p_market, v_uid, 'sell', p_outcome, v_net, v_fee, v_sell, v_prob);

  return json_build_object('shares', v_sell, 'amount_kobo', v_net, 'fee_kobo', v_fee,
                           'prob_yes', v_prob, 'balance_kobo', v_bal);
end $$;

-- ---------------------------------------------------------------------
-- Market proposals (students) and admin moderation
-- ---------------------------------------------------------------------
create or replace function public.propose_market(
  p_school text, p_question text, p_category text, p_criteria text, p_source text, p_closes_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_pending int; v_max int;
begin
  if v_uid is null then raise exception 'Please log in to propose a market'; end if;
  if p_closes_at < now() + interval '1 hour' then
    raise exception 'Closing time must be at least 1 hour from now';
  end if;
  select max_pending_proposals into v_max from public.settings where id = 1;
  select count(*) into v_pending from public.markets where created_by = v_uid and status = 'pending';
  if v_pending >= v_max then
    raise exception 'You already have % proposals waiting for review', v_pending;
  end if;
  insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by)
  values (p_school, trim(p_question), p_category, trim(p_criteria), trim(p_source), p_closes_at, v_uid)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.approve_market(p_market uuid, p_initial_prob numeric, p_liquidity_kobo bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m public.markets; v_l numeric; v_p numeric;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_liquidity_kobo < 100000 then raise exception 'Liquidity must be at least ₦1,000'; end if;
  v_p := least(0.95, greatest(0.05, p_initial_prob));
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'pending' then raise exception 'Only pending markets can be approved'; end if;
  if m.closes_at <= now() then raise exception 'This market''s closing time has already passed'; end if;
  v_l := p_liquidity_kobo::numeric / 10000;
  update public.markets
     set status = 'open', initial_prob = v_p,
         pool_yes = 2 * v_l * (1 - v_p), pool_no = 2 * v_l * v_p,
         liquidity_kobo = p_liquidity_kobo, approved_at = now(), admin_note = null
   where id = p_market;
end $$;

create or replace function public.reject_market(p_market uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.markets set status = 'rejected', admin_note = left(p_note, 300)
   where id = p_market and status = 'pending';
  if not found then raise exception 'Only pending markets can be rejected'; end if;
end $$;

-- Pays every winning share N100 straight into the holder's wallet.
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
        format('Won: market resolved %s', p_outcome));
      v_total := v_total + v_pay;
      v_winners := v_winners + 1;
    end if;
  end loop;

  update public.markets set status = 'resolved', resolution = p_outcome, resolved_at = now() where id = p_market;
  return json_build_object('winners', v_winners, 'paid_kobo', v_total);
end $$;

-- Voids a market and refunds what each holder has net invested.
create or replace function public.cancel_market(p_market uuid, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.markets; r record; v_total bigint := 0;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'Only open markets can be cancelled'; end if;

  for r in
    select user_id, sum(cost_kobo)::bigint as cost from public.positions
     where market_id = p_market group by user_id order by user_id
  loop
    if r.cost > 0 then
      perform public._wallet_move(r.user_id, r.cost, 'refund', p_market, null, 'Refund: market cancelled');
      v_total := v_total + r.cost;
    end if;
  end loop;

  update public.markets set status = 'cancelled', resolved_at = now(), admin_note = left(p_note, 300)
   where id = p_market;
  return json_build_object('refunded_kobo', v_total);
end $$;

-- ---------------------------------------------------------------------
-- Deposits (called by the server with the service role after Paystack verifies)
-- ---------------------------------------------------------------------
create or replace function public.confirm_deposit(p_reference text, p_amount_kobo bigint, p_channel text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d public.deposits;
begin
  select * into d from public.deposits where reference = p_reference for update;
  if not found then raise exception 'Unknown deposit reference'; end if;
  if d.status = 'success' then return false; end if;  -- already credited (idempotent)
  if p_amount_kobo <> d.amount_kobo then
    update public.deposits set status = 'failed' where reference = p_reference;
    raise exception 'Deposit amount mismatch';
  end if;
  update public.deposits set status = 'success', paid_at = now(), channel = p_channel where reference = p_reference;
  perform public._wallet_move(d.user_id, d.amount_kobo, 'deposit', null, p_reference, 'Wallet funding (Paystack)');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Withdrawals: user requests (money is held), admin approves -> Paystack transfer
-- ---------------------------------------------------------------------
create or replace function public.request_withdrawal(p_amount_kobo bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); a public.payout_accounts; v_min bigint; v_id uuid;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  select min_withdrawal_kobo into v_min from public.settings where id = 1;
  if p_amount_kobo is null or p_amount_kobo < v_min then
    raise exception 'Minimum withdrawal is ₦%', v_min / 100;
  end if;
  select * into a from public.payout_accounts where user_id = v_uid;
  if not found then raise exception 'Add a payout bank account in Settings first'; end if;

  insert into public.withdrawals (user_id, amount_kobo, bank_name, account_number, account_name, recipient_code)
  values (v_uid, p_amount_kobo, a.bank_name, a.account_number, a.account_name, a.recipient_code)
  returning id into v_id;
  perform public._wallet_move(v_uid, -p_amount_kobo, 'withdrawal', null, v_id::text,
    format('Withdrawal to %s ••%s', a.bank_name, right(a.account_number, 4)));
  return v_id;
end $$;

create or replace function public.mark_withdrawal_processing(p_id uuid, p_transfer_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.withdrawals set status = 'processing', transfer_code = p_transfer_code
   where id = p_id and status = 'pending';
  if not found then raise exception 'Withdrawal is not pending'; end if;
end $$;

create or replace function public.complete_withdrawal(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.withdrawals set status = 'paid', processed_at = now()
   where id = p_id and status in ('pending', 'processing');
  return found;
end $$;

-- Rejects or fails a withdrawal and returns the held money to the wallet.
create or replace function public.fail_withdrawal(p_id uuid, p_status public.withdrawal_status, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare w public.withdrawals;
begin
  if p_status not in ('rejected', 'failed') then raise exception 'Invalid status'; end if;
  select * into w from public.withdrawals where id = p_id for update;
  if not found or w.status not in ('pending', 'processing') then return false; end if;
  update public.withdrawals set status = p_status, admin_note = left(p_note, 300), processed_at = now()
   where id = p_id;
  perform public._wallet_move(w.user_id, w.amount_kobo, 'withdrawal_refund', null, p_id::text,
    'Withdrawal returned to wallet');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.buy_shares(uuid, public.outcome, bigint, numeric) to authenticated;
grant execute on function public.sell_shares(uuid, public.outcome, numeric, bigint) to authenticated;
grant execute on function public.propose_market(text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.request_withdrawal(bigint) to authenticated;
grant execute on function public.approve_market(uuid, numeric, bigint) to authenticated;   -- checks is_admin()
grant execute on function public.reject_market(uuid, text) to authenticated;              -- checks is_admin()
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated;   -- checks is_admin()
grant execute on function public.cancel_market(uuid, text) to authenticated;              -- checks is_admin()

-- Server-only (service role key): deposits and payout status changes
grant execute on function public.confirm_deposit(text, bigint, text) to service_role;
grant execute on function public.mark_withdrawal_processing(uuid, text) to service_role;
grant execute on function public.complete_withdrawal(uuid) to service_role;
grant execute on function public.fail_withdrawal(uuid, public.withdrawal_status, text) to service_role;
grant execute on function public._wallet_move(uuid, bigint, public.ledger_kind, uuid, text, text) to service_role;

-- Stop future functions being callable by everyone by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Table privileges: Supabase grants broad table rights to API roles by
-- default. Lock them down so users can only change what they should.
-- ---------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant insert, delete on public.comments to authenticated;           -- still limited by RLS to own rows
grant update (username, full_name, school_id) on public.profiles to authenticated;
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
