import { Clock, CreditCard, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { FormMessage } from "@/components/forms";
import { requireViewer } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { isTestMode } from "@/lib/env";
import { formatNaira, formatSignedNaira } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getRequestTime } from "@/lib/time";
import type { LedgerEntry, PayoutAccount, Withdrawal } from "@/lib/types";
import type { P2PStatus } from "@/app/actions/wallet";
import { Activity } from "./Activity";
import { WalletActions } from "./WalletActions";

export const metadata: Metadata = { title: "Wallet · UniPred" };

const DEPOSIT_NOTICE: Record<string, { error?: string; message?: string }> = {
  success: { message: "Payment received. Your wallet has been funded." },
  cancelled: { error: "Payment was cancelled. No money was taken." },
  failed: { error: "We couldn't confirm that payment. If you were debited, it will be credited automatically once Paystack confirms." },
};

/** Ledger kinds that count as trading results (for the 24h change). */
const RESULT_KINDS = new Set(["trade_buy", "trade_sell", "payout", "refund", "referral"]);

export default async function WalletPage(props: PageProps<"/wallet">) {
  const viewer = await requireViewer("/wallet");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [settings, { data: account }, { data: ledger }, { data: withdrawals }, { data: p2p }] = await Promise.all([
    getSettings(),
    supabase
      .from("payout_accounts")
      .select("bank_code, bank_name, account_number, account_name")
      .eq("user_id", viewer.id)
      .maybeSingle<PayoutAccount>(),
    supabase.from("ledger").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(150),
    supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", viewer.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false }),
    supabase.rpc("my_p2p_status"),
  ]);
  const notice = typeof sp.deposit === "string" ? DEPOSIT_NOTICE[sp.deposit] : undefined;
  const initial = sp.action === "deposit" || sp.action === "withdraw" || sp.action === "send" ? sp.action : null;

  const entries = (ledger ?? []) as LedgerEntry[];
  const pending = (withdrawals ?? []) as Withdrawal[];
  const held = pending.reduce((s, w) => s + w.amount_kobo, 0);
  const since = getRequestTime() - 86_400_000;
  const change24h = entries
    .filter((l) => RESULT_KINDS.has(l.kind) && new Date(l.created_at).getTime() >= since)
    .reduce((s, l) => s + l.amount_kobo, 0);

  return (
    <Container narrow>
      {notice && (
        <div className="mb-4">
          <FormMessage {...notice} />
        </div>
      )}

      {/* Balance */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-[#123222] via-card to-card p-5">
        <div className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-brand/15 blur-3xl" />
        <p className="relative text-xs font-medium text-muted">Balance</p>
        <p className="relative mt-1 text-[40px] font-black leading-none tabular-nums text-white">{formatNaira(viewer.balanceKobo)}</p>
        <div className="relative mt-2 flex flex-wrap items-center gap-2 text-xs">
          {change24h !== 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                change24h > 0 ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
              }`}
            >
              {change24h > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {formatSignedNaira(change24h)} 24h
            </span>
          )}
          {held > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">
              <Clock className="size-3" /> {formatNaira(held)} withdrawing
            </span>
          )}
        </div>

        <div className="relative mt-5">
          <WalletActions
            minDepositKobo={settings.min_deposit_kobo}
            minWithdrawalKobo={settings.min_withdrawal_kobo}
            balanceKobo={viewer.balanceKobo}
            account={account ?? null}
            p2p={(p2p as P2PStatus | null) ?? null}
            initial={initial}
            testModeNote={
              isTestMode ? (
                <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[11px] text-amber-100">
                  <CreditCard className="size-4 shrink-0 text-amber-300" />
                  <p>
                    Test card <span className="font-mono">4084 0840 8408 4081</span>, any future expiry, CVV{" "}
                    <span className="font-mono">408</span>, PIN <span className="font-mono">0000</span>, OTP{" "}
                    <span className="font-mono">123456</span>.
                    {!viewer.profile.is_admin && (
                      <>
                        {" "}
                        <b>Test funds:</b> up to 2 test deposits a day, ₦500,000 each.
                      </>
                    )}
                  </p>
                </div>
              ) : null
            }
          />
        </div>
      </section>

      {/* Pending withdrawals, only when there are some */}
      {pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pending.map((w) => (
            <li key={w.id} className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-sm">
              <span className="inline-flex items-center gap-2 text-amber-100">
                <Clock className="size-4 text-amber-300" /> Withdrawal {w.status === "pending" ? "in review" : "on its way"}
              </span>
              <span className="font-bold tabular-nums text-white">{formatNaira(w.amount_kobo)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Activity ledger={entries} />
      </div>
    </Container>
  );
}
