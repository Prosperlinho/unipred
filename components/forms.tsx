"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const inputCls =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-white">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p className="flex items-start gap-1.5 rounded-xl bg-no/10 px-3 py-2 text-sm text-no" role="alert">
        <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
      </p>
    );
  }
  if (message) {
    return (
      <p className="flex items-start gap-1.5 rounded-xl bg-yes/10 px-3 py-2 text-sm text-yes" role="status">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {message}
      </p>
    );
  }
  return null;
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-2xl border border-line bg-card/60 p-6">
        <h1 className="font-serif text-2xl text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
