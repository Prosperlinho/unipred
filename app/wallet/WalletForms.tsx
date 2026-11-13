"use client";

import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { requestWithdrawal, startDeposit } from "@/app/actions/wallet";
import { FormMessage, inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";
import type { PayoutAccount } from "@/lib/types";

const QUICK = [500, 1000, 2000, 5000];

function AmountInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">₦</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        placeholder="0"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} py-3 pl-8 text-lg font-semibold tabular-nums`}
      />
    </div>
  );
}

export function DepositForm({ minKobo }: { minKobo: number }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kobo = Math.round((Number.parseFloat(amount) || 0) * 100);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await startDeposit(kobo);
      if (!res.ok) return setError(res.error);
      window.location.href = res.value;
    });
  };

  return (
    <div className="space-y-3">
      <label htmlFor="deposit-amount" className="block text-xs font-semibold text-white">
        Amount to add
      </label>
      <AmountInput id="deposit-amount" value={amount} onChange={setAmount} disabled={pending} />
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            className="rounded-lg border border-line bg-bg py-1.5 text-xs font-semibold text-white hover:bg-card-2"
          >
            ₦{q.toLocaleString()}
          </button>
        ))}
      </div>
      {error && <FormMessage error={error} />}
      <button
        type="button"
        onClick={submit}
        disabled={pending || kobo < minKobo}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
        {pending ? "Opening Paystack..." : kobo >= minKobo ? `Pay ${formatNaira(kobo)} with Paystack` : `Minimum ${formatNaira(minKobo)}`}
      </button>
      <p className="text-center text-[11px] text-muted">Card, bank transfer or USSD via Paystack.</p>
    </div>
  );
}

export function WithdrawForm({
  minKobo,
  balanceKobo,
  account,
}: {
  minKobo: number;
  balanceKobo: number;
  account: PayoutAccount | null;
}) {
  const { toast } = useUI();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const kobo = Math.round((Number.parseFloat(amount) || 0) * 100);

  if (!account) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">Add the bank account you want to be paid into first.</p>
        <Link href="/settings#payout" className="inline-block rounded-xl border border-line px-4 py-2 font-semibold text-white hover:bg-card-2">
          Add payout account
        </Link>
      </div>
    );
  }

  const blocker = kobo > balanceKobo ? "More than your balance" : kobo > 0 && kobo < minKobo ? `Minimum ${formatNaira(minKobo)}` : null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestWithdrawal(kobo);
      if (!res.ok) return setError(res.error);
      setAmount("");
      toast("Withdrawal requested. We'll send it to your bank after review.");
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-bg px-3 py-2 text-xs">
        <p className="text-muted">Paying out to</p>
        <p className="font-semibold text-white">
          {account.account_name} · {account.bank_name} ••{account.account_number.slice(-4)}
        </p>
      </div>
      <label htmlFor="withdraw-amount" className="block text-xs font-semibold text-white">
        Amount to withdraw
      </label>
      <AmountInput id="withdraw-amount" value={amount} onChange={setAmount} disabled={pending} />
      <button
        type="button"
        onClick={() => setAmount(String(Math.floor(balanceKobo / 100)))}
        className="text-xs font-semibold text-brand hover:underline"
      >
        Withdraw everything ({formatNaira(Math.floor(balanceKobo / 100) * 100)})
      </button>
      {error && <FormMessage error={error} />}
      <button
        type="button"
        onClick={submit}
        disabled={pending || kobo <= 0 || !!blocker}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 py-3 font-bold text-white transition hover:border-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpFromLine className="size-4" />}
        {pending ? "Requesting..." : (blocker ?? (kobo > 0 ? `Withdraw ${formatNaira(kobo)}` : "Enter an amount"))}
      </button>
      <p className="text-center text-[11px] text-muted">The amount is held from your balance while we review it.</p>
    </div>
  );
}
