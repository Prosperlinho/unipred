"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { resolveBankAccount, savePayoutAccount, updateProfile } from "@/app/actions/settings";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import type { FormState, PayoutAccount, Profile, School } from "@/lib/types";

const GROUPS: School["ownership"][] = ["Federal", "State", "Private"];

export function ProfileForm({ profile, schools }: { profile: Profile; schools: School[] }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username" htmlFor="username">
          <input
            id="username"
            name="username"
            defaultValue={profile.username}
            pattern="[A-Za-z0-9_]{3,20}"
            title="3-20 letters, numbers or underscores"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Full name" htmlFor="full_name">
          <input id="full_name" name="full_name" defaultValue={profile.full_name} maxLength={80} className={inputCls} />
        </Field>
      </div>
      <Field label="University" htmlFor="school_id">
        <select id="school_id" name="school_id" defaultValue={profile.school_id} className={inputCls}>
          {GROUPS.map((g) => (
            <optgroup key={g} label={`${g} universities`}>
              {schools
                .filter((s) => s.ownership === g)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.short_name})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Saving...">Save profile</SubmitButton>
    </form>
  );
}

export function PayoutForm({
  banks,
  current,
  banksError,
}: {
  banks: { name: string; code: string }[];
  current: PayoutAccount | null;
  banksError: string | null;
}) {
  const { toast } = useUI();
  const [bankCode, setBankCode] = useState(current?.bank_code ?? "");
  const [accountNumber, setAccountNumber] = useState(current?.account_number ?? "");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const valid = bankCode !== "" && /^\d{10}$/.test(accountNumber);

  const verify = () => {
    setError(null);
    setResolvedName(null);
    startTransition(async () => {
      const res = await resolveBankAccount(bankCode, accountNumber);
      if (!res.ok) return setError(res.error);
      setResolvedName(res.value);
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await savePayoutAccount(bankCode, bankName, accountNumber);
      if (!res.ok) return setError(res.error);
      setResolvedName(null);
      toast(`Payout account saved: ${res.value}`);
    });
  };

  if (banksError) return <FormMessage error={banksError} />;

  return (
    <div className="space-y-4">
      {current && (
        <div className="flex items-center gap-2 rounded-xl bg-yes/10 px-3 py-2 text-sm text-yes">
          <BadgeCheck className="size-4 shrink-0" />
          <span>
            {current.account_name} · {current.bank_name} ••{current.account_number.slice(-4)}
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank" htmlFor="bank">
          <select
            id="bank"
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setResolvedName(null);
            }}
            className={inputCls}
          >
            <option value="" disabled>
              Choose your bank
            </option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account number" htmlFor="account_number">
          <input
            id="account_number"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
              setResolvedName(null);
            }}
            placeholder="0123456789"
            className={`${inputCls} tabular-nums`}
          />
        </Field>
      </div>

      {resolvedName && (
        <p className="rounded-xl bg-bg px-3 py-2 text-sm">
          <span className="text-muted">Account name: </span>
          <span className="font-semibold text-white">{resolvedName}</span>
        </p>
      )}
      {error && <FormMessage error={error} />}

      <button
        type="button"
        disabled={!valid || pending}
        onClick={resolvedName ? save : verify}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {resolvedName ? "Yes, that's me. Save account" : "Verify account"}
      </button>
      <p className="text-[11px] text-muted">The account name must match yours. Withdrawals only go to this account.</p>
    </div>
  );
}
