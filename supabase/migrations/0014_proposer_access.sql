-- =====================================================================
-- UniPred 0014: proposing markets is by admin invitation only.
-- Admins grant or remove access per member (Admin page). Admins can
-- always propose. Members can't give themselves access (profiles only
-- grant updates on username, school and leaderboard visibility).
-- Run after 0013. Safe to run more than once.
-- =====================================================================

alter table public.profiles
  add column if not exists can_propose boolean not null default false;

create or replace function public._guard_market_proposer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and not exists (
    select 1 from public.profiles where id = new.created_by and (can_propose or is_admin)
  ) then
    raise exception 'Proposing markets is by invitation. Ask UniPred to give you access.';
  end if;
  return new;
end $$;

drop trigger if exists markets_guard_proposer on public.markets;
create trigger markets_guard_proposer before insert on public.markets
  for each row execute function public._guard_market_proposer();
