-- =====================================================================
-- UniPred 0012: run UniPred at selected universities only.
-- Schools aren't deleted (members and old markets keep their school);
-- inactive schools are hidden from the app and can't get new markets.
-- For now only AE-FUNAI is active. To open another school later:
--   update public.schools set active = true where id = '<school id>';
-- Safe to run more than once.
-- =====================================================================

alter table public.schools add column if not exists active boolean not null default true;
update public.schools set active = (id = 'aefunai');

-- New markets only at active schools (covers proposals and admin-created markets).
create or replace function public._market_school_active()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.schools where id = new.school_id and active) then
    raise exception 'UniPred isn''t open at that university yet';
  end if;
  return new;
end $$;

drop trigger if exists markets_school_active on public.markets;
create trigger markets_school_active before insert on public.markets
  for each row execute function public._market_school_active();
