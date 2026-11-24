-- 0029: General markets for ALL universities.
--
--   * A special "school" with id 'all' ("All universities") holds general markets
--     (national news, JAMB, ASUU, sports...). They show in every member's feed and in the
--     new "General" tab on the Markets page.
--   * Only admins can create general markets.
--   * Nobody can pick 'all' as their own university.
--   * New general markets notify every member who follows that category, at any school.

insert into public.schools (id, name, short_name, state, ownership, active)
values ('all', 'All universities', 'All Unis', 'Nationwide', 'Federal', true)
on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, active = true;

-- Members belong to a real university.
alter table public.profiles drop constraint if exists profiles_real_school;
alter table public.profiles add constraint profiles_real_school check (school_id is distinct from 'all') not valid;

-- Only admins (or the system, e.g. repeating schedules) create general markets.
create or replace function public._guard_general_market()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_id = 'all' and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only UniPred admins can create markets for all universities';
  end if;
  return new;
end $$;
drop trigger if exists markets_guard_general on public.markets;
create trigger markets_guard_general before insert on public.markets
  for each row execute function public._guard_general_market();

-- New-market alerts: general markets go to everyone (by interest), school markets to that school.
create or replace function public._notify_new_market()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'open' or (tg_op = 'UPDATE' and old.status = 'open') then return new; end if;
  -- Room questions go to the room's members only.
  if new.room_id is not null then
    insert into public.notifications (user_id, kind, title, body, url)
    select rm.user_id, 'new_market', 'New in ' || r.name, left(new.question, 300), '/markets/' || new.id
      from public.room_members rm join public.rooms r on r.id = rm.room_id
     where rm.room_id = new.room_id and rm.user_id is distinct from new.created_by;
    return new;
  end if;
  insert into public.notifications (user_id, kind, title, body, url)
  select p.id, 'new_market',
         case when new.school_id = 'all' then 'New for all universities: ' else 'New market: ' end || new.category,
         left(new.question, 300), '/markets/' || new.id
    from public.profiles p
   where (new.school_id = 'all' or p.school_id = new.school_id)
     and new.category = any (coalesce(p.interests, '{}'))
     and p.id is distinct from new.created_by
     and not p.is_banned;
  return new;
end $$;
