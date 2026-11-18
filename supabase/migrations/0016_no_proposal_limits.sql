-- UniPred 0016: no daily limits on creating markets (proposing is invite-only, see 0014).
update public.settings set max_proposals_per_day = 1000000, auto_daily_cap = 1000000 where id = 1;
