-- =====================================================================
-- UniPred 0018: re-save the notification texts from 0017 with the right
-- characters (the emoji and "·" were garbled when pasted). Safe to re-run.
-- =====================================================================

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

create or replace function public._notify_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_from text;
begin
  select username into v_from from public.profiles where id = new.from_user;
  perform public._notify(new.to_user, 'transfer_in', format('You received %s', public._naira(new.amount_kobo)),
    format('From @%s%s', v_from, coalesce(' · ' || new.note, '')), '/wallet');
  return new;
end $$;

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

revoke execute on function public.cron_tick() from public, anon, authenticated;
grant execute on function public.cron_tick() to service_role;

-- Repair notifications already saved with garbled text.
update public.notifications set title = 'Closes in under an hour ⏳' where kind = 'closing_soon';
update public.notifications set title = regexp_replace(title, ' [^ ]*$', ' 🎉') where kind = 'won' and title !~ '🎉$';
update public.notifications set body = replace(body, 'Â·', '·') where kind = 'transfer_in';
