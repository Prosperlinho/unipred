"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import type { FormState, School } from "@/lib/types";

const GROUPS: School["ownership"][] = ["Federal", "State", "Private"];

export function SignupForm({ schools, maxDob }: { schools: School[]; maxDob: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username" htmlFor="username" hint="Shown on comments.">
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
        <Field label="Full name (optional)" htmlFor="full_name">
          <input id="full_name" name="full_name" autoComplete="name" maxLength={80} defaultValue={v.full_name} className={inputCls} />
        </Field>
      </div>
      <Field label="Your university" htmlFor="school_id" hint="Your feed opens on your school. You can browse others too.">
        <select id="school_id" name="school_id" required defaultValue={v.school_id ?? ""} className={inputCls}>
          <option value="" disabled>
            Choose your university
          </option>
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
          I confirm I am 18 or older, I&apos;ll only stake money I can afford to lose, and I accept UniPred&apos;s terms.
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
