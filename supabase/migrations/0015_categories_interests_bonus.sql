-- =====================================================================
-- UniPred 0015
--   1. More market categories.
--   2. Members can save the categories they care about (their feed
--      shows those first / only).
--   3. Welcome bonus for new sign-ups (test mode). Defaults to ₦500,000.
--      SET IT TO 0 BEFORE GOING LIVE:
--        update public.settings set signup_bonus_kobo = 0 where id = 1;
-- Run after 0014. Safe to run more than once.
-- =====================================================================

alter type public.ledger_kind add value if not exists 'bonus';

-- 1. Categories
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check check (category in (
  'Campus Politics', 'Academics', 'Sports', 'Events & Lifestyle',
  'Entertainment & Music', 'Football', 'Hostel Life', 'Tech & Crypto',
  'Fashion & Style', 'Politics & News', 'Exams & Results'
));

-- 2. Interests (null = not chosen yet)
alter table public.profiles add column if not exists interests text[];
grant update (interests) on public.profiles to authenticated;

-- 3. Welcome bonus, paid when the new member's wallet is created.
alter table public.settings add column if not exists signup_bonus_kobo bigint not null default 50000000;

create or replace function public._welcome_bonus()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bonus bigint;
begin
  select signup_bonus_kobo into v_bonus from public.settings where id = 1;
  if coalesce(v_bonus, 0) > 0 then
    perform public._wallet_move(new.user_id, v_bonus, 'bonus', null, null,
      format('Welcome bonus: %s', public._naira(v_bonus)));
  end if;
  return new;
end $$;

drop trigger if exists wallets_welcome_bonus on public.wallets;
create trigger wallets_welcome_bonus after insert on public.wallets
  for each row execute function public._welcome_bonus();
