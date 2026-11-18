"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { PasswordInput } from "@/components/PasswordInput";
import type { FormState } from "@/lib/types";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      {notice && !state.error && <FormMessage message={notice} />}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={
          <Link href="/forgot-password" className="text-brand hover:underline">
            Forgot your password?
          </Link>
        }
      >
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Logging in...">Log in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
