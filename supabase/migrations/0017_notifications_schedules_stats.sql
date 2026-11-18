-- =====================================================================
-- UniPred 0017
--   1. Notifications: in-app inbox, plus delivery bookkeeping for email
--      and phone (web push). Created automatically when a market a member
--      bet on resolves or is cancelled, when a market they care about
--      opens, an hour before a market they bet on closes, and when they
--      receive money.
--   2. Repeating markets that go live on a schedule (admin-made).
--   3. "Market of the day" (featured market).
--   4. Admin dashboard numbers.
--   5. A 10-minute background job (pg_cron) for closing reminders,
--      repeating markets and sending emails/phone notifications.
-- Run after 0016. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables and columns
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz,
  pushed_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_undelivered_idx on public.notifications (created_at) where pushed_at is null;

alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Server-only secrets (no policies: only the service role can read them).
create table if not exists public.app_secrets (key text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (key, value)
values ('cron_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

alter table public.profiles add column if not exists notify_email boolean not null default true;
grant update (notify_email) on public.profiles to authenticated;

alter table public.markets
  add column if not exists featured_at timestamptz,
  add column if not exists closing_notified boolean not null default false;

alter table public.settings add column if not exists site_url text not null default 'https://unipred.site';

create table if not exists public.market_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id),
  category text not null,
  question text not null check (char_length(question) between 12 and 160),
  criteria text not null,
  source text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  weekday int check (weekday between 0 and 6),          -- 0 = Sunday (weekly only)
  run_hour int not null default 8 check (run_hour between 0 and 23), -- Lagos time
  close_after_hours int not null default 24 check (close_after_hours between 1 and 2880),
  next_run_at timestamptz not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.market_schedules enable row level security;
revoke all on public.market_schedules from anon, authenticated;

-- ---------------------------------------------------------------------
-- Creating notifications
-- ---------------------------------------------------------------------
create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_url text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, url)
  values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 300), p_url);
$$;

-- Results: everyone who bet hears how it went.
create or replace function public._notify_market_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_url text := '/markets/' || new.id;
begin
  if new.status = old.status or new.status not in ('resolved', 'cancelled') then return new; end if;
  for r in
    select l.user_id,
           coalesce(sum(l.amount_kobo) filter (where l.kind = 'payout'), 0)::bigint as won,
           coalesce(sum(l.amount_kobo) filter (where l.kind = 'refund'), 0)::bigint as refunded
      from public.ledger l
     where l.market_id = new.id and l.kind in ('trade_buy', 'payout', 'refund')
     group by l.user_id
  loop
    if new.status = 'cancelled' then
      perform public._notify(r.user_id, 'refund', 'Market cancelled: you were refunded', new.question, v_url);
    elsif r.won > 0 then
      perform public._notify(r.user_id, 'won', format('You won %s 🎉', public._naira(r.won)),
        format('%s resolved %s', new.question, new.resolution), v_url);
    elsif r.refunded > 0 then
      perform public._notify(r.user_id, 'refund', format('Refunded %s', public._naira(r.refunded)), new.question, v_url);
    else
      perform public._notify(r.user_id, 'lost', format('Resolved %s', new.resolution),
        new.question || ' Better luck on the next one.', v_url);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists markets_notify_result on public.markets;
create trigger markets_notify_result after update of status on public.markets
  for each row execute function public._notify_market_result();

-- New market: members who picked that category (same university) hear about it.
create or replace function public._notify_new_market()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'open' or (tg_op = 'UPDATE' and old.status = 'open') then return new; end if;
  insert into public.notifications (user_id, kind, title, body, url)
  select p.id, 'new_market', 'New market: ' || new.category, left(new.question, 300), '/markets/' || new.id
    from public.profiles p
   where p.school_id = new.school_id
     and new.category = any (coalesce(p.interests, '{}'))
     and p.id is distinct from new.created_by
     and not p.is_banned;
  return new;
end $$;

drop trigger if exists markets_notify_new on public.markets;
create trigger markets_notify_new after insert or update of status on public.markets
  for each row execute function public._notify_new_market();

-- Money received from another member.
create or replace function public._notify_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_from text;
begin
  select username into v_from from public.profiles where id = new.from_user;
  perform public._notify(new.to_user, 'transfer_in', format('You received %s', public._naira(new.amount_kobo)),
    format('From @%s%s', v_from, coalesce(' · ' || new.note, '')), '/wallet');
  return new;
end $$;

drop trigger if exists transfers_notify on public.transfers;
create trigger transfers_notify after insert on public.transfers
  for each row execute function public._notify_transfer();

-- ---------------------------------------------------------------------
-- Delivery (called by the server with the service role)
-- ---------------------------------------------------------------------
create or replace function public.notifications_to_deliver(p_limit int default 100)
returns table (id bigint, user_id uuid, kind text, title text, body text, url text,
               email text, want_email boolean, emailed boolean, pushed boolean)
language sql stable security definer set search_path = public, auth as $$
  select n.id, n.user_id, n.kind, n.title, n.body, n.url, u.email::text, p.notify_email,
         n.emailed_at is not null, n.pushed_at is not null
    from public.notifications n
    join public.profiles p on p.id = n.user_id
    join auth.users u on u.id = n.user_id
   where n.pushed_at is null and n.created_at > now() - interval '2 days'
   order by n.created_at
   limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.mark_notifications_sent(p_ids bigint[], p_emailed bigint[])
returns void language sql security definer set search_path = public as $$
  update public.notifications set pushed_at = now() where id = any (p_ids);
  update public.notifications set emailed_at = now() where id = any (p_emailed);
$$;

-- ---------------------------------------------------------------------
-- Background job: closing reminders, repeating markets, then ask the
-- website to send emails / phone notifications.
-- ---------------------------------------------------------------------
create or replace function public.cron_tick()
returns json language plpgsql security definer set search_path = public as $$
declare
  m record; s public.market_schedules; v_q text; v_next timestamptz; v_closes timestamptz;
  v_reminded int := 0; v_created int := 0; v_url text; v_secret text;
begin
  -- 1. "Closes in under an hour" for people who bet.
  for m in
    select id, question from public.markets
     where status = 'open' and not closing_notified
       and closes_at > now() and closes_at <= now() + interval '1 hour'
     for update skip locked
  loop
    insert into public.notifications (user_id, kind, title, body, url)
    select distinct l.user_id, 'closing_soon', 'Closes in under an hour ⏳', left(m.question, 300), '/markets/' || m.id
      from public.ledger l where l.market_id = m.id and l.kind = 'trade_buy';
    update public.markets set closing_notified = true where id = m.id;
    v_reminded := v_reminded + 1;
  end loop;

  -- 2. Repeating markets that are due.
  for s in select * from public.market_schedules where active and next_run_at <= now() for update skip locked loop
    v_q := replace(s.question, '{date}', to_char(now() at time zone 'Africa/Lagos', 'DD Mon'));
    v_closes := now() + make_interval(hours => s.close_after_hours);
    begin
      insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by, engine,
                                  status, initial_prob, approved_at, auto_approved)
      values (s.school_id, v_q, s.category,
              format('Resolves YES if %s, as confirmed by %s, on or before the closing time (%s, Lagos time). Resolves NO if this has not happened by then.',
                     trim(trailing '.' from s.criteria), s.source, to_char(v_closes at time zone 'Africa/Lagos', 'DD Mon YYYY, HH24:MI')),
              s.source, v_closes, s.created_by, 'pool', 'open', 0.5, now(), true);
      v_created := v_created + 1;
    exception when others then
      raise notice 'schedule % skipped: %', s.id, sqlerrm;
    end;
    v_next := s.next_run_at;
    loop
      v_next := v_next + case s.cadence when 'weekly' then interval '7 days' else interval '1 day' end;
      exit when v_next > now();
    end loop;
    update public.market_schedules set next_run_at = v_next where id = s.id;
  end loop;

  -- 3. Nudge the website to deliver anything new (needs the pg_net extension).
  select site_url || '/api/notify/dispatch' into v_url from public.settings where id = 1;
  select value into v_secret from public.app_secrets where key = 'cron_secret';
  if exists (select 1 from public.notifications where pushed_at is null and created_at > now() - interval '2 days') then
    begin
      execute 'select net.http_post(url := $1, headers := $2, body := ''{}''::jsonb)'
        using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret);
    exception when others then
      raise notice 'dispatch ping skipped: %', sqlerrm;
    end;
  end if;

  return json_build_object('reminded', v_reminded, 'created', v_created);
end $$;

-- Schedule the job every 10 minutes (Supabase has pg_cron and pg_net).
do $$
begin
  begin
    create extension if not exists pg_net;
  exception when others then raise notice 'pg_net not available: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'unipred-tick';
    perform cron.schedule('unipred-tick', '*/10 * * * *', 'select public.cron_tick()');
  exception when others then raise notice 'pg_cron not available: %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------
-- Admin dashboard numbers (service role only)
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns json language sql stable security definer set search_path = public as $$
  with days as (
    select generate_series((now() at time zone 'Africa/Lagos')::date - 13, (now() at time zone 'Africa/Lagos')::date, '1 day')::date as d
  ),
  lg as (
    select (created_at at time zone 'Africa/Lagos')::date as d, kind, amount_kobo, user_id, market_id from public.ledger
     where created_at > now() - interval '15 days'
  ),
  fees as (
    -- What UniPred kept: everything bettors paid in minus everything paid back, on finished markets.
    select coalesce(-sum(l.amount_kobo), 0)::bigint as kobo
      from public.ledger l join public.markets m on m.id = l.market_id
     where m.status in ('resolved', 'cancelled') and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund', 'referral')
  ),
  fees_week as (
    select coalesce(-sum(l.amount_kobo), 0)::bigint as kobo
      from public.ledger l join public.markets m on m.id = l.market_id
     where m.status in ('resolved', 'cancelled') and m.resolved_at > now() - interval '7 days'
       and l.kind in ('trade_buy', 'trade_sell', 'payout', 'refund', 'referral')
  )
  select json_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'bettors_7d', (select count(distinct user_id) from public.ledger where kind = 'trade_buy' and created_at > now() - interval '7 days'),
    'live_markets', (select count(*) from public.markets where status = 'open' and closes_at > now()),
    'awaiting_result', (select count(*) from public.markets where status = 'open' and closes_at <= now()),
    'volume_7d', (select coalesce(-sum(amount_kobo), 0) from public.ledger where kind = 'trade_buy' and created_at > now() - interval '7 days'),
    'deposits_7d', (select coalesce(sum(amount_kobo), 0) from public.ledger where kind = 'deposit' and created_at > now() - interval '7 days'),
    'withdrawals_7d', (select coalesce(-sum(amount_kobo), 0) from public.ledger where kind = 'withdrawal' and created_at > now() - interval '7 days'),
    'fees_total', (select kobo from fees),
    'fees_7d', (select kobo from fees_week),
    'invite_bonuses_total', (select coalesce(sum(amount_kobo), 0) from public.ledger where kind = 'referral'),
    'wallets_total', (select coalesce(sum(balance_kobo), 0) from public.wallets),
    'daily', (
      select json_agg(json_build_object(
        'day', d.d,
        'signups', (select count(*) from public.profiles p where (p.created_at at time zone 'Africa/Lagos')::date = d.d),
        'bettors', (select count(distinct user_id) from lg where lg.d = d.d and kind = 'trade_buy'),
        'volume', (select coalesce(-sum(amount_kobo), 0) from lg where lg.d = d.d and kind = 'trade_buy'),
        'deposits', (select coalesce(sum(amount_kobo), 0) from lg where lg.d = d.d and kind = 'deposit')
      ) order by d.d) from days d
    ),
    'top_categories', (
      select coalesce(json_agg(t order by t.volume desc), '[]'::json) from (
        select m.category, count(distinct m.id) as markets, coalesce(-sum(l.amount_kobo), 0) as volume
          from public.markets m join public.ledger l on l.market_id = m.id and l.kind = 'trade_buy'
         where l.created_at > now() - interval '30 days'
         group by m.category order by 3 desc limit 6
      ) t
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public._notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notifications_to_deliver(int) from public, anon, authenticated;
revoke execute on function public.mark_notifications_sent(bigint[], bigint[]) from public, anon, authenticated;
revoke execute on function public.cron_tick() from public, anon, authenticated;
revoke execute on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.notifications_to_deliver(int) to service_role;
grant execute on function public.mark_notifications_sent(bigint[], bigint[]) to service_role;
grant execute on function public.cron_tick() to service_role;
grant execute on function public.admin_stats() to service_role;

-- Is the background job scheduled? (for checking the setup)
create or replace function public.cron_status()
returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  execute $q$select json_build_object('scheduled', count(*) > 0, 'schedule', max(schedule)) from cron.job where jobname = 'unipred-tick'$q$ into v;
  return v;
exception when others then
  return json_build_object('scheduled', false, 'error', sqlerrm);
end $$;
revoke execute on function public.cron_status() from public, anon, authenticated;
grant execute on function public.cron_status() to service_role;
