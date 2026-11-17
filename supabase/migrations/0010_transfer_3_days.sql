-- UniPred 0010: members can send money once their account is 3 days old (was 7).
update public.settings set p2p_min_account_days = 3 where id = 1;
