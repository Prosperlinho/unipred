"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import type { FormState } from "@/lib/types";
import { Field, FormMessage, SubmitButton } from "./forms";
import { PasswordInput } from "./PasswordInput";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Saving...">Update password</SubmitButton>
    </form>
  );
}
