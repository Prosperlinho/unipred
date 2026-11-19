-- =====================================================================
-- UniPred 0026: when an admin clears a deposit flag, the member is marked
-- as checked so the payer-name check doesn't flag them again on every
-- deposit (e.g. a parent paying for them). Suspensions still work.
-- Safe to run more than once.
-- =====================================================================
alter table public.profiles add column if not exists payer_check_waived boolean not null default false;
