-- =====================================================================
-- 0006: house-rules acceptance, welcome guide, referral bonus from fees,
--       identity protection (locked full name, one bank account per person,
--       suspensions). Run once, after 0001-0005.
-- =====================================================================

-- ---- New ledger entry type for invite bonuses -------------------------------
alter type public.ledger_kind add value if not exists 'referral';

-- ---- Settings ---------------------------------------------------------------
alter table public.settings
  add column if not exists referral_share_bps int not null default 2000 check (referral_share_bps between 0 and 5000), -- 20% of UniPred's fee
  add column if not exists terms_version int not null default 1;

-- ---- Profiles ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version int not null default 0,
  add column if not exists onboarded_at timestamptz,
  add column if not exists is_banned boolean not null default false,
  add column if not exists ban_reason text,
  add column if not exists flagged_reason text,
  add column if not exists payout_name_strikes int not null default 0;

-- Existing users already know their way around: the welcome guide is for new sign-ups only.
update public.profiles set onboarded_at = now() where onboarded_at is null;

-- Full name is locked: it must match the bank account used for withdrawals.
revoke update (full_name) on public.profiles from authenticated;

-- One bank account can belong to only one UniPred account.
create unique index if not exists payout_accounts_bank_account_unique
  on public.payout_accounts (bank_code, account_number);

-- ---------------------------------------------------------------------
-- Self-service functions
-- ---------------------------------------------------------------------
create or replace function public.accept_terms(p_version int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  update public.profiles set terms_accepted_at = now(), terms_version = p_version where id = auth.uid();
end $$;

create or replace function public.mark_onboarded()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set onboarded_at = now() where id = auth.uid() and onboarded_at is null;
end $$;

-- Lets users who signed up before full names were required set theirs once.
create or replace function public.set_full_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if array_length(string_to_array(v_name, ' '), 1) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your first and last name exactly as on your bank account';
  end if;
  update public.profiles set full_name = v_name where id = auth.uid() and coalesce(full_name, '') = '';
  if not found then raise exception 'Your full name is already set and can''t be changed'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Guards: suspended accounts and users who haven't accepted the rules
-- can't bet, propose, comment or withdraw.
-- ---------------------------------------------------------------------
create or replace function public._guard_user_id()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select is_banned, terms_accepted_at into p from public.profiles where id = new.user_id;
  if p.is_banned then raise exception 'Your account is suspended. Contact UniPred support.'; end if;
  if p.terms_accepted_at is null then raise exception 'Please read and accept the house rules first'; end if;
  return new;
end $$;

create or replace function public._guard_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.created_by is null then return new; end if;
  select is_banned, terms_accepted_at into p from public.profiles where id = new.created_by;
  if p.is_banned then raise exception 'Your account is suspended. Contact UniPred support.'; end if;
  if p.terms_accepted_at is null then raise exception 'Please read and accept the house rules first'; end if;
  return new;
end $$;

drop trigger if exists guard_positions on public.positions;
create trigger guard_positions before insert or update on public.positions
  for each row execute function public._guard_user_id();
drop trigger if exists guard_withdrawals on public.withdrawals;
create trigger guard_withdrawals before insert on public.withdrawals
  for each row execute function public._guard_user_id();
drop trigger if exists guard_comments on public.comments;
create trigger guard_comments before insert on public.comments
  for each row execute function public._guard_user_id();
drop trigger if exists guard_markets on public.markets;
create trigger guard_markets before insert on public.markets
  for each row execute function public._guard_created_by();

-- ---------------------------------------------------------------------
-- Resolve: pool payouts + invite bonus paid out of UniPred's fee.
-- Every bettor who was invited earns their inviter
--   fee * (bettor's stake / whole pot) * referral_share
-- so the bonus can never exceed the fee, and UniPred never adds money.
-- ---------------------------------------------------------------------
create or replace function public.resolve_market(p_market uuid, p_outcome public.outcome)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.markets; s public.settings; r record;
  v_win bigint; v_lose bigint; v_pay bigint; v_bonus bigint;
  v_total bigint := 0; v_winners int := 0; v_fee bigint := 0; v_ref_total bigint := 0;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.settings where id = 1;
  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' then raise exception 'Only open markets can be resolved'; end if;

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

    if v_fee > 0 and s.referral_share_bps > 0 then
      for r in
        select inv.referred_by as referrer, sum(p.cost_kobo)::bigint as staked
          from public.positions p
          join public.profiles inv on inv.id = p.user_id
          join public.profiles ref on ref.id = inv.referred_by
         where p.market_id = p_market and p.cost_kobo > 0 and not ref.is_banned
         group by inv.referred_by
         order by inv.referred_by
      loop
        v_bonus := floor((v_fee::numeric * r.staked * s.referral_share_bps) / ((v_win + v_lose)::numeric * 10000))::bigint;
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

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public.accept_terms(int) from public, anon;
grant execute on function public.accept_terms(int) to authenticated;
revoke execute on function public.mark_onboarded() from public, anon;
grant execute on function public.mark_onboarded() to authenticated;
revoke execute on function public.set_full_name(text) from public, anon;
grant execute on function public.set_full_name(text) to authenticated;
revoke execute on function public.resolve_market(uuid, public.outcome) from public, anon;
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated;
revoke execute on function public._guard_user_id() from public, anon, authenticated;
revoke execute on function public._guard_created_by() from public, anon, authenticated;
