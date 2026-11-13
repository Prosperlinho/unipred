"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthCard, Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import type { FormState } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to set a new one.">
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
        </Field>
        <FormMessage error={state.error} message={state.message} />
        <SubmitButton pendingText="Sending...">Send reset link</SubmitButton>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Back to log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
