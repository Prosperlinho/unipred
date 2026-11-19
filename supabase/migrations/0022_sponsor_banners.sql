-- =====================================================================
-- UniPred 0022: sponsorship banners.
-- Admins add a banner (image, title, description, link, button text) and
-- choose where it shows: home (under the swipe deck), markets (top of the
-- list), leaderboard (under the prize pool). Optional start/end dates.
-- Images go in a public "banners" storage bucket.
-- Run after 0021. Safe to run more than once.
-- =====================================================================

create table if not exists public.sponsor_banners (
  id uuid primary key default gen_random_uuid(),
  sponsor text not null check (char_length(sponsor) between 1 and 60),
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 240),
  image_url text check (image_url is null or image_url ~ '^https://'),
  link_url text check (link_url is null or link_url ~ '^https://'),
  cta text check (char_length(cta) <= 24),
  placements text[] not null default '{home,markets,leaderboard}',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sponsor_banners enable row level security;
drop policy if exists "live banners are public" on public.sponsor_banners;
create policy "live banners are public" on public.sponsor_banners for select
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
revoke insert, update, delete on public.sponsor_banners from anon, authenticated;
grant select on public.sponsor_banners to anon, authenticated;

-- Public bucket for banner images (uploads happen server-side with the service role).
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = true;
