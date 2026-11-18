-- =====================================================================
-- UniPred 0021: community rooms.
--   * Anyone can create a room, public (anyone can join) or private
--     (join with the invite link/code).
--   * The room host drops YES/NO questions; members stake on YES or NO
--     (same pool betting, fees and payouts as normal markets).
--   * The room host decides the result (or cancels and refunds).
--   * Room questions don't appear in the main feed and don't count for
--     the leaderboard or the weekly prize pool.
--   * UniPred admins can suspend a room.
-- Run after 0020. Safe to run more than once.
-- =====================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 50),
  description text check (char_length(description) <= 200),
  owner_id uuid not null references public.profiles (id),
  is_public boolean not null default true,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

alter table public.markets add column if not exists room_id uuid references public.rooms (id) on delete set null;
create index if not exists markets_room_idx on public.markets (room_id) where room_id is not null;

create or replace function public._is_room_member(p_room uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = p_user);
$$;

-- Can this person see the room (and its questions)?
create or replace function public._can_see_room(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms r
     where r.id = p_room
       and (public.is_admin() or (r.is_public and not r.suspended) or public._is_room_member(r.id, auth.uid()))
  );
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
drop policy if exists "see rooms" on public.rooms;
create policy "see rooms" on public.rooms for select using (public._can_see_room(id));
drop policy if exists "see room members" on public.room_members;
create policy "see room members" on public.room_members for select using (public._can_see_room(room_id));
revoke insert, update, delete on public.rooms, public.room_members from anon, authenticated;
grant select on public.rooms, public.room_members to anon, authenticated;

-- Room questions are only visible to people who can see the room.
drop policy if exists "read live markets or own proposals" on public.markets;
create policy "read live markets or own proposals" on public.markets for select
  using (
    (status in ('open', 'resolved', 'cancelled') and (room_id is null or public._can_see_room(room_id)))
    or created_by = auth.uid()
  );

-- Only room members can bet on a room question, and not in a suspended room.
create or replace function public._guard_room_bet()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_suspended boolean;
begin
  if new.side <> 'buy' then return new; end if;
  select m.room_id, r.suspended into v_room, v_suspended
    from public.markets m left join public.rooms r on r.id = m.room_id where m.id = new.market_id;
  if v_room is null then return new; end if;
  if v_suspended then raise exception 'This room has been suspended'; end if;
  if not public._is_room_member(v_room, new.user_id) then raise exception 'Join this room to bet on its questions'; end if;
  return new;
end $$;
drop trigger if exists trades_guard_room on public.trades;
create trigger trades_guard_room before insert on public.trades
  for each row execute function public._guard_room_bet();

-- ---------------------------------------------------------------------
-- Room actions
-- ---------------------------------------------------------------------
create or replace function public.create_room(p_name text, p_description text, p_public boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); p public.profiles; v_id uuid; v_code text; v_recent int;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  select * into p from public.profiles where id = v_uid;
  if p.is_banned then raise exception 'Your account is suspended'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Give the room a name (at least 3 characters)'; end if;
  select count(*) into v_recent from public.rooms where owner_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 5 then raise exception 'You can create up to 5 rooms a day'; end if;
  insert into public.rooms (name, description, owner_id, is_public)
  values (left(trim(p_name), 50), nullif(left(trim(coalesce(p_description, '')), 200), ''), v_uid, coalesce(p_public, true))
  returning id, invite_code into v_id, v_code;
  insert into public.room_members (room_id, user_id) values (v_id, v_uid);
  return json_build_object('id', v_id, 'invite_code', v_code);
end $$;

-- Join a public room by id, or any room with its invite code.
create or replace function public.join_room(p_room uuid, p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.rooms;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if p_code is not null and trim(p_code) <> '' then
    select * into r from public.rooms where invite_code = upper(trim(p_code));
  else
    select * into r from public.rooms where id = p_room;
  end if;
  if not found then raise exception 'Room not found. Check the invite link.'; end if;
  if r.suspended then raise exception 'This room has been suspended'; end if;
  if not r.is_public and (p_code is null or upper(trim(p_code)) <> r.invite_code) then
    raise exception 'This room is private. Ask the host for the invite link.';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, v_uid) on conflict do nothing;
  return r.id;
end $$;

create or replace function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'Hosts can''t leave their own room';
  end if;
  delete from public.room_members where room_id = p_room and user_id = auth.uid();
end $$;

-- The host drops a YES/NO question into their room.
create or replace function public.room_drop_question(
  p_room uuid, p_question text, p_details text, p_category text, p_closes_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.rooms; v_school text; v_id uuid; v_q text; s public.settings;
begin
  select * into r from public.rooms where id = p_room;
  if not found or r.owner_id is distinct from v_uid then raise exception 'Only the room host can drop questions'; end if;
  if r.suspended then raise exception 'This room has been suspended'; end if;
  select * into s from public.settings where id = 1;
  v_q := trim(p_question);
  if char_length(v_q) < 8 or char_length(v_q) > 160 then raise exception 'Question must be 8-160 characters'; end if;
  if p_closes_at < now() + make_interval(mins => s.min_market_minutes) then
    raise exception 'Closing time must be at least % minutes from now', s.min_market_minutes;
  end if;
  if p_closes_at > now() + interval '120 days' then raise exception 'Closing time must be within 120 days'; end if;
  select school_id into v_school from public.profiles where id = v_uid;
  insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by, engine,
                              status, initial_prob, approved_at, room_id)
  values (v_school, v_q, coalesce(nullif(p_category, ''), 'Events & Lifestyle'),
          format('%sThe room host (%s) decides the result after betting closes (%s, Lagos time).',
                 coalesce(nullif(trim(p_details), '') || ' ', ''), r.name,
                 to_char(p_closes_at at time zone 'Africa/Lagos', 'DD Mon YYYY, HH24:MI')),
          'Room host', p_closes_at, v_uid, 'pool', 'open', 0.5, now(), p_room)
  returning id into v_id;
  return v_id;
end $$;

-- Admin: suspend or restore a room.
create or replace function public.set_room_suspended(p_room uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.rooms set suspended = p_suspended where id = p_room;
end $$;

-- ---------------------------------------------------------------------
-- Updated functions (bodies from earlier migrations, edits marked)
-- ---------------------------------------------------------------------
create or replace function public._guard_market_proposer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Room hosts may create questions in their own room.
  if new.room_id is not null and exists (
    select 1 from public.rooms r where r.id = new.room_id and r.owner_id = new.created_by and not r.suspended
  ) then return new; end if;
  if new.created_by is not null and not exists (
    select 1 from public.profiles where id = new.created_by and (can_propose or is_admin)
  ) then
    raise exception 'Proposing markets is by invitation. Ask UniPred to give you access.';
  end if;
  return new;
end $$;

create or replace function public.resolve_market(p_market uuid, p_outcome public.outcome)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.markets; s public.settings; r record;
  v_win bigint; v_lose bigint; v_pay bigint; v_bonus bigint;
  v_total bigint := 0; v_winners int := 0; v_fee bigint := 0; v_ref_total bigint := 0;
begin
  -- UniPred admins, or the host of the room this question belongs to.
  if not (public.is_admin() or exists (select 1 from public.markets mm join public.rooms host_room on host_room.id = mm.room_id
                 where mm.id = p_market and host_room.owner_id = auth.uid() and not host_room.suspended)) then raise exception 'Only the room host or an admin can decide this result'; end if;
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

    if v_fee > 0 then
      for r in
        select inv.referred_by as referrer,
               coalesce(ref.referral_bps_override, s.referral_share_bps) as rate,
               sum(p.cost_kobo)::bigint as staked
          from public.positions p
          join public.profiles inv on inv.id = p.user_id
          join public.profiles ref on ref.id = inv.referred_by
         where p.market_id = p_market and p.cost_kobo > 0 and not ref.is_banned
           and public._referral_qualified(inv.id)
         group by inv.referred_by, ref.referral_bps_override
         order by inv.referred_by
      loop
        v_bonus := floor((v_fee::numeric * r.staked * r.rate) / ((v_win + v_lose)::numeric * 10000))::bigint;
        -- Never pay out more than the fee in total, whatever the rates.
        v_bonus := least(v_bonus, v_fee - v_ref_total);
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

create or replace function public.cancel_market(p_market uuid, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.markets; r record; v_total bigint := 0;
begin
  if not (public.is_admin() or exists (select 1 from public.markets mm join public.rooms host_room on host_room.id = mm.room_id
                 where mm.id = p_market and host_room.owner_id = auth.uid() and not host_room.suspended)) then raise exception 'Only the room host or an admin can cancel this'; end if;
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

create or replace function public.leaderboard(p_period text default 'week', p_school text default null, p_limit int default 50)
returns table (rank int, username text, school_id text, profit_kobo bigint, markets int, won int)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select case p_period when 'all' then '-infinity'::timestamptz
                         when 'last_week' then public.season_start(1)
                         else public.season_start(0) end as s,
           case p_period when 'all' then 'infinity'::timestamptz
                         when 'last_week' then public.season_start(0)
                         else public.season_start(0) + interval '7 days' end as e
  ),
  scored as (
    select l.user_id,
           sum(l.amount_kobo)::bigint as profit,
           count(distinct l.market_id)::int as markets,
           count(distinct l.market_id) filter (where l.kind = 'payout')::int as won
      from public.ledger l
      join public.markets m on m.id = l.market_id
      cross join bounds b
     where m.status = 'resolved' and m.resolved_at >= b.s and m.resolved_at < b.e and m.room_id is null
       and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id
  )
  select (row_number() over (order by sc.profit desc, sc.won desc, p.username))::int,
         p.username, p.school_id, sc.profit, sc.markets, sc.won
    from scored sc join public.profiles p on p.id = sc.user_id
   where sc.profit > 0 and not p.is_banned and not p.leaderboard_hidden
     and (p_school is null or p.school_id = p_school)
   order by 1
   limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.prize_standings(p_week date)
returns table (rank int, user_id uuid, username text, hidden boolean, school_id text,
               profit_kobo bigint, markets int, prize_kobo bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select (p_week::timestamp at time zone 'Africa/Lagos') as s,
           ((p_week + 7)::timestamp at time zone 'Africa/Lagos') as e
  ),
  eligible_markets as (
    select m.id from public.markets m cross join b
     where m.status = 'resolved' and m.resolved_at >= b.s and m.resolved_at < b.e and m.room_id is null
       and (select count(distinct l.user_id) from public.ledger l where l.market_id = m.id and l.kind = 'trade_buy') >= 3
  ),
  scored as (
    select l.user_id, sum(l.amount_kobo)::bigint as profit, count(distinct l.market_id)::int as markets
      from public.ledger l join eligible_markets em on em.id = l.market_id
     where l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund')
     group by l.user_id
  ),
  ranked as (
    select (row_number() over (order by sc.profit desc, sc.markets desc, p.username))::int as rank,
           sc.user_id, p.username, p.leaderboard_hidden, p.school_id, sc.profit, sc.markets
      from scored sc join public.profiles p on p.id = sc.user_id
     where sc.profit > 0 and sc.markets >= 5 and not p.is_banned
  ),
  pool as (select coalesce((select pool_kobo from public.weekly_prizes where week_start = p_week), 0) as kobo)
  select r.rank, r.user_id, r.username, r.leaderboard_hidden, r.school_id, r.profit, r.markets,
         floor((select kobo from pool) * (array[0.40, 0.25, 0.15, 0.12, 0.08])[r.rank])::bigint
    from ranked r
   where r.rank <= 5
   order by r.rank;
$$;

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
  select p.id, 'new_market', 'New market: ' || new.category, left(new.question, 300), '/markets/' || new.id
    from public.profiles p
   where p.school_id = new.school_id
     and new.category = any (coalesce(p.interests, '{}'))
     and p.id is distinct from new.created_by
     and not p.is_banned;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public._is_room_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public._can_see_room(uuid) to anon, authenticated;
revoke execute on function public.create_room(text, text, boolean) from public, anon;
grant execute on function public.create_room(text, text, boolean) to authenticated;
revoke execute on function public.join_room(uuid, text) from public, anon;
grant execute on function public.join_room(uuid, text) to authenticated;
revoke execute on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;
revoke execute on function public.room_drop_question(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.room_drop_question(uuid, text, text, text, timestamptz) to authenticated;
revoke execute on function public.set_room_suspended(uuid, boolean) from public, anon;
grant execute on function public.set_room_suspended(uuid, boolean) to authenticated;
revoke execute on function public.resolve_market(uuid, public.outcome) from public, anon;
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated;
revoke execute on function public.cancel_market(uuid, text) from public, anon;
grant execute on function public.cancel_market(uuid, text) to authenticated;
revoke execute on function public.prize_standings(date) from public, anon, authenticated;
grant execute on function public.prize_standings(date) to service_role;
