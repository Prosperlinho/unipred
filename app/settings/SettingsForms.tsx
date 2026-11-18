"use client";

import { AlertTriangle, BadgeCheck, Loader2, Lock } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { resolveBankAccount, savePayoutAccount, setFullName, setLeaderboardHidden, updateProfile, type ResolvedAccount } from "@/app/actions/settings";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { useUI } from "@/context/UIContext";
import type { FormState, PayoutAccount, Profile, School } from "@/lib/types";

export function ProfileForm({ profile, schools }: { profile: Profile; schools: School[] }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const [school, setSchool] = useState(profile.school_id);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Field label="Full name (locked)" htmlFor="full_name_locked">
          <div
            id="full_name_locked"
            className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-white/80"
          >
            <Lock className="size-4 shrink-0 text-muted" />
            <span className="truncate">{profile.full_name || "Not set yet"}</span>
          </div>
        </Field>
      </div>
      <p className="text-[11px] text-muted">
        Can&apos;t be changed. Must match your bank account.
      </p>
      <Field label="University" htmlFor="school_id">
        <SchoolCombobox
          id="school_id"
          name="school_id"
          schools={schools}
          value={school}
          onChange={setSchool}
          mySchoolId={profile.school_id}
        />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Saving...">Save profile</SubmitButton>
    </form>
  );
}

/** One-time form for accounts created before full names were required. */
export function SetFullNameForm() {
  const [state, action] = useActionState<FormState, FormData>(setFullName, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <p>
          Add your full name exactly as it appears on your bank account. <b>You can only do this once</b>, and withdrawals
          will only go to a bank account in this name.
        </p>
      </div>
      <Field label="Full name" htmlFor="set_full_name">
        <input id="set_full_name" name="full_name" required maxLength={80} placeholder="e.g. Adebayo John Oluwaseun" className={inputCls} />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Saving...">Save full name</SubmitButton>
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
  const [resolved, setResolved] = useState<ResolvedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const valid = bankCode !== "" && /^\d{10}$/.test(accountNumber);

  const verify = () => {
    setError(null);
    setResolved(null);
    startTransition(async () => {
      const res = await resolveBankAccount(bankCode, accountNumber);
      if (!res.ok) return setError(res.error);
      setResolved(res.value);
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await savePayoutAccount(bankCode, bankName, accountNumber);
      if (!res.ok) return setError(res.error);
      setResolved(null);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Bank" htmlFor="bank">
          <select
            id="bank"
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setResolved(null);
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
              setResolved(null);
            }}
            placeholder="0123456789"
            className={`${inputCls} tabular-nums`}
          />
        </Field>
      </div>

      {resolved &&
        (resolved.matches ? (
          <p className="flex items-center gap-2 rounded-xl bg-yes/10 px-3 py-2 text-sm text-yes">
            <BadgeCheck className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">{resolved.accountName}</span> matches your name.
            </span>
          </p>
        ) : (
          <div className="flex gap-2 rounded-xl border border-no/40 bg-no/10 p-3 text-sm text-no">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <b>{resolved.accountName}</b> is not your name, so it can&apos;t be used. Only a bank account in your own name
              is allowed. {resolved.strikesLeft > 0
                ? `${resolved.strikesLeft} more attempt${resolved.strikesLeft === 1 ? "" : "s"} with someone else's account will suspend your UniPred account.`
                : ""}
            </p>
          </div>
        ))}
      {error && <FormMessage error={error} />}

      <button
        type="button"
        disabled={!valid || pending || (resolved !== null && !resolved.matches)}
        onClick={resolved?.matches ? save : verify}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {resolved?.matches ? "Save this account" : "Verify account"}
      </button>
      <p className="text-[11px] text-muted">
        Must be in your name, and can only be linked to one UniPred account.
      </p>
    </div>
  );
}

/** Opt in or out of the public leaderboard. */
export function LeaderboardToggle({ hidden }: { hidden: boolean }) {
  const { toast } = useUI();
  const [isHidden, setIsHidden] = useState(hidden);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-bg p-3 text-sm">
      <span>
        <span className="block font-semibold text-white">Show me on the leaderboard</span>
        <span className="text-xs text-muted">Other members see your username, university and profit when you rank.</span>
      </span>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-brand"
        checked={!isHidden}
        disabled={pending}
        onChange={(e) => {
          const nextHidden = !e.target.checked;
          setIsHidden(nextHidden);
          startTransition(async () => {
            const res = await setLeaderboardHidden(nextHidden);
            if (!res.ok) {
              setIsHidden(!nextHidden);
              toast(res.error, "error");
            } else toast(nextHidden ? "You're hidden from the leaderboard." : "You'll show on the leaderboard.");
          });
        }}
      />
    </label>
  );
}
