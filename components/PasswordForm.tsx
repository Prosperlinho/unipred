"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import type { FormState } from "@/lib/types";
import { Field, FormMessage, SubmitButton, inputCls } from "./forms";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Saving...">Update password</SubmitButton>
    </form>
  );
}
