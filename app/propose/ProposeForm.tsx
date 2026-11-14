"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { proposeMarket } from "@/app/actions/market";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { CATEGORIES, type FormState, type School } from "@/lib/types";

const SOURCE_SUGGESTIONS = [
  "the university's official website",
  "the official student result portal",
  "the SUG Electoral Committee's official notice",
  "the Sports Council's official result sheet",
  "the Registrar's official announcement",
  "the Students' Affairs Division notice board",
  "the organisers' official social media page",
  "at least two national newspapers",
];

export function ProposeForm({ schools, defaultSchool }: { schools: School[]; defaultSchool: string }) {
  const [state, action] = useActionState<FormState, FormData>(proposeMarket, {});
  const v = state.values ?? {};
  const [school, setSchool] = useState(defaultSchool);
  const [condition, setCondition] = useState(v.criteria ?? "");
  const [source, setSource] = useState(v.source ?? "");
  const [closesAt, setClosesAt] = useState(v.closes_at ?? "");

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

      <Field label="University" htmlFor="school_id">
        <SchoolCombobox
          id="school_id"
          name="school_id"
          schools={schools}
          value={school}
          onChange={setSchool}
          mySchoolId={defaultSchool}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <Field
        label="YES happens if..."
        htmlFor="criteria"
        hint="One clear, checkable event. Avoid opinions (“best”, “popular”) and anything about a private person."
      >
        <textarea
          id="criteria"
          name="criteria"
          rows={2}
          maxLength={300}
          required
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="the University Librarian announces 24-hour opening for exam week"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Confirmed by" htmlFor="source" hint="The official place the result will appear.">
          <input
            id="source"
            name="source"
            list="source-suggestions"
            maxLength={200}
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="the university's official website"
            className={inputCls}
          />
          <datalist id="source-suggestions">
            {SOURCE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Trading closes" htmlFor="closes_at" hint="Between 1 hour and 120 days from now.">
          <input
            id="closes_at"
            name="closes_at"
            type="datetime-local"
            required
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
          <ShieldCheck className="size-4" /> The rule traders will see
        </p>
        <p className="leading-relaxed text-white/90">
          Resolves <b className="text-yes">YES</b> if{" "}
          <span className={condition.trim() ? "text-white" : "text-muted"}>
            {condition.trim().replace(/\.$/, "") || "[what has to happen]"}
          </span>
          , as confirmed by{" "}
          <span className={source.trim() ? "text-white" : "text-muted"}>{source.trim() || "[source]"}</span>, on or before
          the closing time
          {closesAt ? ` (${new Date(closesAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })})` : ""}.
          Resolves <b className="text-no">NO</b> if this has not happened by then.
        </p>
      </div>

      <p className="text-xs text-muted">
        Clear proposals usually go live instantly at 50/50 odds. UniPred admins confirm the result from the source above,
        and winners are paid automatically. Up to 3 proposals per day.
      </p>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Publishing...">Publish market</SubmitButton>
    </form>
  );
}
