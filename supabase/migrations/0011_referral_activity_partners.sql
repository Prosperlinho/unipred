-- =====================================================================
-- UniPred 0011
--   1. Invite bonuses only count for invited friends who are ACTIVE:
--      at least 5 bets a day on 3 days in a row (Lagos time). Until a
--      friend qualifies, their bets earn the inviter nothing.
--   2. Partner rates: admins can give a big partner (an entity) a special
--      invite rate instead of the standard one. Still paid only from
--      UniPred's fee, so it can never cost more than the fee.
--   3. Markets can close as soon as 5 minutes from now (was 1 hour).
-- Run after 0010. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings and the partner rate column
-- ---------------------------------------------------------------------
alter table public.settings
  add column if not exists referral_min_daily_bets int not null default 5,
  add column if not exists referral_streak_days int not null default 3,
  add column if not exists min_market_minutes int not null default 5;

-- Members can't edit this: profiles only grant update on username/school.
alter table public.profiles
  add column if not exists referral_bps_override int
    check (referral_bps_override is null or referral_bps_override between 0 and 10000);

-- ---------------------------------------------------------------------
-- Has this member had N bets a day for K days in a row?
-- ---------------------------------------------------------------------
create or replace function public._referral_qualified(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with s as (select referral_min_daily_bets as per_day, referral_streak_days as streak from public.settings where id = 1),
  days as (
    select (t.created_at at time zone 'Africa/Lagos')::date as d
      from public.trades t
     where t.user_id = p_uid and t.side = 'buy'
     group by 1
    having count(*) >= (select per_day from s)
  ),
  runs as (select d, d - (row_number() over (order by d))::int as grp from days)
  select coalesce(max(cnt) >= (select streak from s), false)
    from (select count(*) as cnt from runs group by grp) x;
$$;

-- Progress for one invited friend: best streak so far and today's bets.
create or replace function public._referral_progress(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  with s as (select referral_min_daily_bets as per_day, referral_streak_days as streak from public.settings where id = 1),
  days as (
    select (t.created_at at time zone 'Africa/Lagos')::date as d
      from public.trades t
     where t.user_id = p_uid and t.side = 'buy'
     group by 1
    having count(*) >= (select per_day from s)
  ),
  runs as (select d, d - (row_number() over (order by d))::int as grp from days),
  best as (select coalesce(max(cnt), 0) as best from (select count(*) as cnt from runs group by grp) x)
  select json_build_object(
    'qualified', (select best from best) >= (select streak from s),
    'best_streak', least((select best from best), (select streak from s)),
    'bets_today', (select count(*) from public.trades t where t.user_id = p_uid and t.side = 'buy'
                    and (t.created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date));
$$;

-- The signed-in member's invite stats: friends joined, active, their rate.
create or replace function public.my_referral_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); s public.settings; v_rate int; v_joined int; v_active int; v_friends json;
begin
  if v_uid is null then return null; end if;
  select * into s from public.settings where id = 1;
  select coalesce(referral_bps_override, s.referral_share_bps) into v_rate from public.profiles where id = v_uid;
  select count(*) into v_joined from public.profiles where referred_by = v_uid;
  select count(*) into v_active from public.profiles where referred_by = v_uid and public._referral_qualified(id);
  select coalesce(json_agg(f order by f.qualified, f.joined desc), '[]'::json) into v_friends from (
    select p.username, p.created_at as joined,
           (pr ->> 'qualified')::boolean as qualified,
           (pr ->> 'best_streak')::int as best_streak,
           (pr ->> 'bets_today')::int as bets_today
      from public.profiles p, lateral (select public._referral_progress(p.id) as pr) x
     where p.referred_by = v_uid
     order by p.created_at desc
     limit 50
  ) f;
  return json_build_object(
    'rate_bps', v_rate,
    'is_partner', exists (select 1 from public.profiles where id = v_uid and referral_bps_override is not null),
    'joined', v_joined, 'active', v_active,
    'min_daily_bets', s.referral_min_daily_bets, 'streak_days', s.referral_streak_days,
    'friends', v_friends);
end $$;

-- ---------------------------------------------------------------------
-- Resolve: invite bonus only for qualified friends, at the inviter's rate.
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

-- ---------------------------------------------------------------------
-- Proposals: closing time can be 5 minutes away (setting), not 1 hour.
-- Same as 0005 otherwise.
-- ---------------------------------------------------------------------
create or replace function public.propose_market(
  p_school text, p_question text, p_category text, p_criteria text, p_source text, p_closes_at timestamptz
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.settings;
  v_id uuid; v_recent int; v_auto_today int; v_rule text; v_question text; v_condition text;
begin
  if v_uid is null then raise exception 'Please log in to propose a market'; end if;
  select * into s from public.settings where id = 1;
  v_question := trim(p_question);
  v_condition := trim(trailing '.' from trim(p_criteria));

  if p_closes_at < now() + make_interval(mins => s.min_market_minutes) then
    raise exception 'Closing time must be at least % minutes from now', s.min_market_minutes;
  end if;
  if p_closes_at > now() + interval '120 days' then raise exception 'Closing time must be within 120 days'; end if;
  if char_length(v_condition) < 10 then raise exception 'Describe exactly what has to happen for YES'; end if;

  select count(*) into v_recent from public.markets
   where created_by = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= s.max_proposals_per_day then
    raise exception 'You can propose up to % markets per day. Try again tomorrow.', s.max_proposals_per_day;
  end if;

  if exists (select 1 from public.markets
              where school_id = p_school and status in ('pending', 'open')
                and lower(question) = lower(v_question)) then
    raise exception 'That market already exists at this university';
  end if;

  v_rule := format(
    'Resolves YES if %s, as confirmed by %s, on or before the closing time (%s, Lagos time). Resolves NO if this has not happened by then.',
    v_condition, trim(p_source), to_char(p_closes_at at time zone 'Africa/Lagos', 'DD Mon YYYY, HH24:MI'));

  insert into public.markets (school_id, question, category, criteria, source, closes_at, created_by, engine)
  values (p_school, v_question, p_category, v_rule, trim(p_source), p_closes_at, v_uid, 'pool')
  returning id into v_id;

  select count(*) into v_auto_today from public.markets
   where auto_approved and approved_at > now() - interval '24 hours';

  if s.auto_approve and v_auto_today < s.auto_daily_cap then
    update public.markets set status = 'open', initial_prob = 0.5, approved_at = now(), auto_approved = true
     where id = v_id;
    return json_build_object('id', v_id, 'status', 'open');
  end if;
  return json_build_object('id', v_id, 'status', 'pending');
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public._referral_qualified(uuid) from public, anon, authenticated;
revoke execute on function public._referral_progress(uuid) from public, anon, authenticated;
revoke execute on function public.my_referral_stats() from public, anon;
grant execute on function public.my_referral_stats() to authenticated;
revoke execute on function public.resolve_market(uuid, public.outcome) from public, anon;
grant execute on function public.resolve_market(uuid, public.outcome) to authenticated; -- checks is_admin()

-- Partner list for the admin page (server-side admin client only).
create or replace function public.partner_stats()
returns table (username text, rate_bps int, joined int, active int)
language sql stable security definer set search_path = public as $$
  select p.username, p.referral_bps_override,
         (select count(*)::int from public.profiles f where f.referred_by = p.id),
         (select count(*)::int from public.profiles f where f.referred_by = p.id and public._referral_qualified(f.id))
    from public.profiles p
   where p.referral_bps_override is not null
   order by p.referral_bps_override desc, p.username;
$$;
revoke execute on function public.partner_stats() from public, anon, authenticated;
grant execute on function public.partner_stats() to service_role;
