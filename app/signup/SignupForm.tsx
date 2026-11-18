"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import type { FormState, School } from "@/lib/types";

export function SignupForm({ schools, maxDob }: { schools: School[]; maxDob: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const [school, setSchool] = useState("");

  const v = state.values ?? {};

  if (state.message) {
    return (
      <div className="space-y-4">
        <FormMessage message={state.message} />
        <p className="text-sm text-muted">
          Didn&apos;t get it? Check spam, or{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            go to log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} required className={inputCls} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputCls}
        />
      </Field>
      <Field label="Full name (exactly as on your bank account)" htmlFor="full_name">
        <input
          id="full_name"
          name="full_name"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={v.full_name}
          placeholder="e.g. Adebayo John Oluwaseun"
          className={inputCls}
        />
      </Field>
      <div className="flex gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <p>
          <b>Use your real name.</b> It can&apos;t be changed, and withdrawals only go to a bank account in this name. One
          account per person.
        </p>
      </div>
      <Field label="Username" htmlFor="username" hint="Shown on comments and your cards.">
        <input
          id="username"
          name="username"
          autoComplete="username"
          defaultValue={v.username}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3-20 letters, numbers or underscores"
          required
          className={inputCls}
        />
      </Field>
      <Field label="Your university" htmlFor="school_id" hint="Your feed opens on your school. You can browse others too.">
        <SchoolCombobox id="school_id" name="school_id" schools={schools} value={school} onChange={setSchool} />
      </Field>
      <Field label="Date of birth" htmlFor="date_of_birth" hint="You must be 18 or older.">
        <input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          max={maxDob}
          defaultValue={v.date_of_birth}
          required
          className={`${inputCls} [color-scheme:dark]`}
        />
      </Field>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input name="terms" type="checkbox" required className="mt-0.5 size-4 accent-[var(--color-brand)]" />
        <span>
          I confirm I am 18 or older, I&apos;ll only stake money I can afford to lose, and I accept UniPred&apos;s{" "}
          <Link href="/terms" target="_blank" className="text-brand underline">
            Terms
          </Link>
          ,{" "}
          <Link href="/rules" target="_blank" className="text-brand underline">
            House Rules
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="text-brand underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
