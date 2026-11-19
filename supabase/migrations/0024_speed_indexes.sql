-- =====================================================================
-- UniPred 0024: indexes for the heavier queries (leaderboard, prize pool,
-- admin numbers, referral activity). Safe to run more than once.
-- =====================================================================

create index if not exists ledger_market_kind_idx on public.ledger (market_id, kind) where market_id is not null;
create index if not exists ledger_kind_time_idx on public.ledger (kind, created_at desc);
create index if not exists trades_user_side_time_idx on public.trades (user_id, side, created_at);
create index if not exists markets_resolved_idx on public.markets (resolved_at) where status = 'resolved';
create index if not exists markets_open_room_idx on public.markets (closes_at) where status = 'open' and room_id is null;
create index if not exists profiles_school_idx on public.profiles (school_id);

analyze public.ledger;
analyze public.trades;
analyze public.markets;
analyze public.profiles;
