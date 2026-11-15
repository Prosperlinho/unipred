# UniPred setup: Supabase + Paystack (test mode)

About 20 minutes. You need a Supabase account and a Paystack account. Both are free to start.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard and click **New project**. Pick a region close to Nigeria (e.g. *West EU (London)* or *Central EU (Frankfurt)*), and set a strong database password.
2. When it's ready, open **SQL Editor → New query** and run these files **in order**, pasting each one and clicking **Run**:
   1. `supabase/migrations/0001_init.sql` (tables, security rules, money functions)
   2. `supabase/migrations/0002_schools.sql` (the university list)
   3. `supabase/migrations/0003_all_universities.sql` (all 330 NUC-approved universities)
   4. `supabase/migrations/0004_templates_autoapprove_referrals.sql` (rule template, auto-approval, naira wording, referrals)
   5. `supabase/migrations/0005_pool_betting.sql` (pool betting: UniPred never risks its own money)
   6. *(optional)* `supabase/optional_starter_markets.sql`: opens 6 sample markets. Change `v_school` at the top to your launch university first.
3. Open **Authentication → URL Configuration**:
   - **Site URL**: `https://unipred.vercel.app`
   - **Redirect URLs**: add `https://unipred.vercel.app/**`, `https://unipred-*.vercel.app/**` (Vercel previews) and `http://localhost:3000/**`
4. Open **Authentication → Sign In / Providers → Email** and make sure **Confirm email** is on.
5. Open **Project Settings → API Keys** (or **API**) and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**keep this secret**)

> Supabase's built-in email sender is limited to a few emails per hour. Before launch, add your own SMTP in **Authentication → Emails → SMTP Settings** (Resend, Brevo, Zoho, etc.).

## 2. Paystack (test mode)

1. Sign up at https://dashboard.paystack.com. You can use test mode before your business is verified.
2. Make sure the toggle at the top says **Test Mode**.
3. **Settings → API Keys & Webhooks**:
   - Copy the **Test Secret Key** (`sk_test_...`) → `PAYSTACK_SECRET_KEY`
   - Set **Test Webhook URL** to `https://unipred.vercel.app/api/paystack/webhook`
4. **Settings → Preferences → Transfers**: turn off "Confirm transfers with OTP" so admin payouts don't need an OTP each time.

Test card for deposits: `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`.

## 3. Add the keys

**Locally:** copy `.env.example` to `.env.local` and fill in the four values, then `npm run dev`.

**On Vercel:** Project → **Settings → Environment Variables**, add the same four keys for Production and Preview, then redeploy.

## 4. Make yourself admin

Sign up on the site with your own email and confirm it. Then in Supabase **SQL Editor** run:

```sql
update public.profiles set is_admin = true where username = 'YOUR_USERNAME';
```

Log out and back in. You'll see **Admin** in the header.

## How money moves

| Action | What happens |
| --- | --- |
| Deposit | Paystack checkout → verified server-side and by webhook → wallet credited once |
| Bet | Pool betting (`place_bet`): the stake leaves the wallet and goes into the market's YES or NO pot |
| Resolve | Admin picks YES/NO → each winner gets their stake back + a share of the losing pot (in proportion to their stake), minus UniPred's fee on those winnings (`settings.pool_fee_bps`, default 10%) |
| No other side | Nobody bet on the losing side → winners get their stake back. Nobody backed the winner → everyone is refunded |
| Cancel | Admin cancels → everyone's stake is refunded |
| Withdraw | User requests → amount is held → admin approves → Paystack transfer → webhook marks it paid (or refunds on failure) |

UniPred never puts its own money into a market, so there is no liquidity to fund and no risk per market: it only
ever pays winners out of the losing side's money, and keeps its fee from that.

Every balance change is written to the `ledger` table with the balance after it, so you can audit any wallet.

Change the fee and limits any time:

```sql
-- pool_fee_bps: UniPred's cut of the winnings (1000 = 10%)
update public.settings set pool_fee_bps = 1000, min_trade_kobo = 10000,
  min_deposit_kobo = 10000, min_withdrawal_kobo = 100000 where id = 1;
```

Auto-approval of student proposals (on by default):

```sql
-- auto_daily_cap: max auto-approved markets per 24h across everyone; extra ones wait for admin
-- max_proposals_per_day: per student
update public.settings set auto_approve = true, auto_daily_cap = 30, max_proposals_per_day = 3 where id = 1;

-- Turn auto-approval off (everything waits in Admin):
update public.settings set auto_approve = false where id = 1;
```

Add a university:

```sql
insert into public.schools (id, name, short_name, state, ownership)
values ('ksu', 'Kogi State University', 'KSU', 'Kogi', 'State');
```

## Before going live with real naira

- Get the gaming licence(s) your lawyer advises (state-level since the Nov 2024 Supreme Court ruling; FSGRN's URC for multiple states).
- Get Paystack's written approval for betting on your account.
- Add identity verification (BVN/NIN) before withdrawals.
- Then swap `PAYSTACK_SECRET_KEY` to the `sk_live_...` key and set the **Live** webhook URL.
