-- 0028: Tasks (social follows) and daily betting streaks, both paid in naira to the wallet.
--
--   * Streak: a day counts only if the member placed at least one bet that day (Lagos time).
--     They claim it on the Tasks page; the reward climbs Day 1 -> Day 7 using
--     settings.streak_rewards_kobo, then repeats. Missing a day resets to Day 1.
--   * Tasks: one-time social tasks (follow on X, join WhatsApp, ...). Admin sets the link and
--     reward. Each account can claim each task once.
--   Payouts use the 'bonus' ledger kind, so they show in wallet history like the signup bonus.

alter table public.settings
  add column if not exists streak_rewards_kobo bigint[] not null default '{2000,3000,5000,7000,10000,15000,30000}';

create table if not exists public.reward_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 200),
  url text not null check (url ~ '^https://'),
  platform text not null default 'other'
    check (platform in ('x', 'instagram', 'tiktok', 'whatsapp', 'telegram', 'youtube', 'facebook', 'other')),
  reward_kobo bigint not null default 0 check (reward_kobo between 0 and 10000000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reward_tasks enable row level security;
drop policy if exists "active tasks are public" on public.reward_tasks;
create policy "active tasks are public" on public.reward_tasks for select using (active);

create table if not exists public.task_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.reward_tasks (id) on delete cascade,
  reward_kobo bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table public.task_claims enable row level security;
drop policy if exists "own task claims" on public.task_claims;
create policy "own task claims" on public.task_claims for select using (user_id = auth.uid());

create table if not exists public.streak_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  streak int not null check (streak >= 1),
  reward_kobo bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists streak_claims_user_day_idx on public.streak_claims (user_id, day desc);
alter table public.streak_claims enable row level security;
drop policy if exists "own streak claims" on public.streak_claims;
create policy "own streak claims" on public.streak_claims for select using (user_id = auth.uid());

-- First task: follow on X (admin can edit it and add Instagram, TikTok, WhatsApp...).
insert into public.reward_tasks (title, description, url, platform, reward_kobo, sort)
select 'Follow UniPred on X', 'Follow @Uni_pred for new markets and results.', 'https://x.com/Uni_pred', 'x', 10000, 1
where not exists (select 1 from public.reward_tasks);

create or replace function public._lagos_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Lagos')::date $$;

/** The member's streak + tasks, for the Tasks page. */
create or replace function public.reward_status()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._lagos_today();
  v_last public.streak_claims;
  v_rewards bigint[];
  v_current int := 0;
  v_next int := 1;
  v_claimed boolean := false;
  v_bet boolean;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  select streak_rewards_kobo into v_rewards from public.settings where id = 1;
  select * into v_last from public.streak_claims where user_id = v_uid order by day desc limit 1;
  if found then
    if v_last.day = v_today then
      v_claimed := true; v_current := v_last.streak; v_next := v_last.streak + 1;
    elsif v_last.day = v_today - 1 then
      v_current := v_last.streak; v_next := v_last.streak + 1;
    end if;
  end if;
  v_bet := exists (
    select 1 from public.trades
     where user_id = v_uid and side = 'buy'
       and created_at >= (v_today::timestamp at time zone 'Africa/Lagos')
  );
  return json_build_object(
    'today', v_today,
    'current_streak', v_current,
    'next_day', v_next,
    'claimed_today', v_claimed,
    'bet_today', v_bet,
    'rewards_kobo', to_json(v_rewards),
    'next_reward_kobo', v_rewards[((v_next - 1) % array_length(v_rewards, 1)) + 1],
    'tasks', coalesce((
      select json_agg(json_build_object(
               'id', t.id, 'title', t.title, 'description', t.description, 'url', t.url,
               'platform', t.platform, 'reward_kobo', t.reward_kobo, 'claimed', c.user_id is not null)
             order by t.sort, t.created_at)
        from public.reward_tasks t
        left join public.task_claims c on c.task_id = t.id and c.user_id = v_uid
       where t.active
    ), '[]'::json)
  );
end $$;

/** Claims today's streak reward. Needs a bet placed today. */
create or replace function public.claim_streak()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public._lagos_today();
  v_last public.streak_claims;
  v_rewards bigint[];
  v_streak int := 1;
  v_amount bigint;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if (select is_banned from public.profiles where id = v_uid) then
    raise exception 'Your account is suspended. Contact UniPred support.';
  end if;
  perform pg_advisory_xact_lock(hashtext('streak:' || v_uid::text));
  if exists (select 1 from public.streak_claims where user_id = v_uid and day = v_today) then
    raise exception 'You already claimed today''s streak. Come back tomorrow.';
  end if;
  if not exists (
    select 1 from public.trades
     where user_id = v_uid and side = 'buy'
       and created_at >= (v_today::timestamp at time zone 'Africa/Lagos')
  ) then
    raise exception 'Place a bet today to claim your streak.';
  end if;
  select streak_rewards_kobo into v_rewards from public.settings where id = 1;
  select * into v_last from public.streak_claims where user_id = v_uid order by day desc limit 1;
  if found and v_last.day = v_today - 1 then v_streak := v_last.streak + 1; end if;
  v_amount := coalesce(v_rewards[((v_streak - 1) % array_length(v_rewards, 1)) + 1], 0);
  insert into public.streak_claims (user_id, day, streak, reward_kobo) values (v_uid, v_today, v_streak, v_amount);
  if v_amount > 0 then
    perform public._wallet_move(v_uid, v_amount, 'bonus', null, 'streak:' || v_today,
      format('Daily streak: day %s', v_streak));
  end if;
  return json_build_object('streak', v_streak, 'amount_kobo', v_amount);
end $$;

/** Claims a one-time task reward. */
create or replace function public.claim_task(p_task uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_task public.reward_tasks;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if (select is_banned from public.profiles where id = v_uid) then
    raise exception 'Your account is suspended. Contact UniPred support.';
  end if;
  select * into v_task from public.reward_tasks where id = p_task and active;
  if not found then raise exception 'This task is no longer available.'; end if;
  insert into public.task_claims (user_id, task_id, reward_kobo) values (v_uid, p_task, v_task.reward_kobo)
  on conflict do nothing;
  if not found then raise exception 'You already claimed this task.'; end if;
  if v_task.reward_kobo > 0 then
    perform public._wallet_move(v_uid, v_task.reward_kobo, 'bonus', null, 'task:' || p_task,
      format('Task reward: %s', v_task.title));
  end if;
  return json_build_object('amount_kobo', v_task.reward_kobo, 'title', v_task.title);
end $$;

revoke execute on function public.reward_status() from public, anon;
revoke execute on function public.claim_streak() from public, anon;
revoke execute on function public.claim_task(uuid) from public, anon;
grant execute on function public.reward_status() to authenticated;
grant execute on function public.claim_streak() to authenticated;
grant execute on function public.claim_task(uuid) to authenticated;
