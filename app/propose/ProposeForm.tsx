"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { proposeMarket } from "@/app/actions/market";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { CATEGORIES, type FormState, type School } from "@/lib/types";

const GROUPS: School["ownership"][] = ["Federal", "State", "Private"];

export function ProposeForm({ schools, defaultSchool }: { schools: School[]; defaultSchool: string }) {
  const [state, action] = useActionState<FormState, FormData>(proposeMarket, {});
  const v = state.values ?? {};

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const tz = e.currentTarget.elements.namedItem("tz_offset");
        if (tz instanceof HTMLInputElement) tz.value = String(new Date().getTimezoneOffset());
      }}
      className="space-y-4"
    >
      <input type="hidden" name="tz_offset" defaultValue="0" />
      <Field label="Market question" htmlFor="question" hint="A clear Yes/No question ending with '?'.">
        <input
          id="question"
          name="question"
          maxLength={160}
          required
          defaultValue={v.question}
          placeholder="Will the library open 24/7 during exam week?"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="University" htmlFor="school_id">
          <select id="school_id" name="school_id" defaultValue={v.school_id ?? defaultSchool} className={inputCls}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={`${g} universities`}>
                {schools
                  .filter((s) => s.ownership === g)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.short_name} · {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Category" htmlFor="category">
          <select id="category" name="category" defaultValue={v.category ?? CATEGORIES[0]} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Resolution criteria" htmlFor="criteria" hint="Exactly what makes this resolve YES, and what makes it NO.">
        <textarea
          id="criteria"
          name="criteria"
          rows={4}
          maxLength={800}
          required
          defaultValue={v.criteria}
          placeholder="Resolves YES if the University Librarian officially announces 24-hour opening for exam week before the closing time..."
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resolution source" htmlFor="source" hint="Where the result will be confirmed.">
          <input
            id="source"
            name="source"
            maxLength={200}
            required
            defaultValue={v.source}
            placeholder="Library notice board / official website"
            className={inputCls}
          />
        </Field>
        <Field label="Trading closes" htmlFor="closes_at" hint="At least 1 hour from now.">
          <input
            id="closes_at"
            name="closes_at"
            type="datetime-local"
            required
            defaultValue={v.closes_at}
            className={`${inputCls} [color-scheme:dark]`}
          />
        </Field>
      </div>

      <div className="flex gap-2 rounded-xl border border-line bg-card p-3 text-xs text-muted">
        <ShieldCheck className="size-4 shrink-0 text-brand" />
        <p>
          Our team reviews every proposal before it goes live, sets the starting odds and funds the pool. We resolve the
          market using the source you give, and winners are paid automatically.
        </p>
      </div>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Submitting...">Submit for review</SubmitButton>
    </form>
  );
}
