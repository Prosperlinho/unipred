-- 0030: Send any amount by username.
-- No daily send/receive caps and a ₦1 minimum: members can send anything up to their wallet balance.
-- The safety checks stay (account age, trades placed, verified bank account in their own name).
update public.settings
   set p2p_min_kobo = 100,                            -- ₦1
       p2p_daily_cap_kobo = 100000000000000,          -- effectively unlimited
       p2p_daily_receive_cap_kobo = 100000000000000   -- effectively unlimited
 where id = 1;
