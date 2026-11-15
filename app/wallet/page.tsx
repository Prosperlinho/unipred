import { CreditCard, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { FormMessage } from "@/components/forms";
import { requireViewer } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { isTestMode } from "@/lib/env";
import { formatDate, formatNaira, formatSignedNaira } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { LedgerEntry, PayoutAccount, Withdrawal } from "@/lib/types";
import { DepositForm, WithdrawForm } from "./WalletForms";

export const metadata: Metadata = { title: "Wallet · UniPred" };

const DEPOSIT_NOTICE: Record<string, { error?: string; message?: string }> = {
  success: { message: "Payment received. Your wallet has been funded." },
  cancelled: { error: "Payment was cancelled. No money was taken." },
  failed: { error: "We couldn't confirm that payment. If you were debited, it will be credited automatically once Paystack confirms." },
};

const W_STATUS: Record<Withdrawal["status"], string> = {
  pending: "text-amber-300",
  processing: "text-sky-300",
  paid: "text-yes",
  rejected: "text-no",
  failed: "text-no",
};

export default async function WalletPage(props: PageProps<"/wallet">) {
  const viewer = await requireViewer("/wallet");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [settings, { data: account }, { data: ledger }, { data: withdrawals }] = await Promise.all([
    getSettings(),
    supabase
      .from("payout_accounts")
      .select("bank_code, bank_name, account_number, account_name")
      .eq("user_id", viewer.id)
      .maybeSingle<PayoutAccount>(),
    supabase.from("ledger").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", viewer.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false }),
  ]);
  const notice = typeof sp.deposit === "string" ? DEPOSIT_NOTICE[sp.deposit] : undefined;

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Wallet</h1>
      <p className="mb-4 text-sm text-muted">Fund your wallet to trade. Winnings land here automatically.</p>
      {notice && (
        <div className="mb-4">
          <FormMessage {...notice} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-linear-to-br from-brand-teal/20 to-card p-5 lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-muted">Available balance</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-white">{formatNaira(viewer.balanceKobo)}</p>
          {(withdrawals ?? []).length > 0 && (
            <p className="mt-1 text-xs text-muted">
              {formatNaira((withdrawals as Withdrawal[]).reduce((s, w) => s + w.amount_kobo, 0))} held for pending withdrawals
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold text-white">Add money</h2>
          <DepositForm minKobo={settings.min_deposit_kobo} />
          {isTestMode && (
            <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[11px] text-amber-100">
              <CreditCard className="size-4 shrink-0 text-amber-300" />
              <p>
                Test mode. Use Paystack&apos;s test card <span className="font-mono">4084 0840 8408 4081</span>, any future
                expiry, CVV <span className="font-mono">408</span>, PIN <span className="font-mono">0000</span>, OTP{" "}
                <span className="font-mono">123456</span>.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold text-white">Withdraw</h2>
          <WithdrawForm minKobo={settings.min_withdrawal_kobo} balanceKobo={viewer.balanceKobo} account={account ?? null} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-semibold text-white">Pending withdrawals</h2>
          {(withdrawals ?? []).length === 0 ? (
            <p className="text-sm text-muted">None right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(withdrawals as Withdrawal[]).map((w) => (
                <li key={w.id} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
                  <span>
                    <span className="font-semibold tabular-nums text-white">{formatNaira(w.amount_kobo)}</span>
                    <span className="block text-[11px] text-muted">{formatDate(w.created_at)}</span>
                  </span>
                  <span className={`text-xs font-semibold capitalize ${W_STATUS[w.status]}`}>
                    {w.status === "pending" ? "In review" : w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4 lg:col-span-3">
          <h2 className="flex items-center gap-1.5 font-semibold text-white">
            <Receipt className="size-4" /> Transactions
          </h2>
          {(ledger ?? []).length === 0 ? (
            <p className="text-sm text-muted">No transactions yet. Fund your wallet to get started.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {(ledger as LedgerEntry[]).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-white">{l.description}</span>
                    <span className="text-[11px] text-muted">{formatDate(l.created_at)}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className={`block font-semibold ${l.amount_kobo >= 0 ? "text-yes" : "text-white"}`}>
                      {formatSignedNaira(l.amount_kobo)}
                    </span>
                    <span className="text-[11px] text-muted">Bal {formatNaira(l.balance_after_kobo)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
