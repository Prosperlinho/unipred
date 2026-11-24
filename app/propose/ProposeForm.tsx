"use client";

import { ShieldCheck, Wand2 } from "lucide-react";
import { useActionState, useState } from "react";
import { proposeMarket } from "@/app/actions/market";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/forms";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { CATEGORIES, GENERAL_SCHOOL_ID, type Category, type FormState, type School } from "@/lib/types";

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

/** Quick-create starting points. Words in [brackets] are blanks to fill in. */
const TEMPLATES: Array<{ label: string; question: string; criteria: string; source: string; category: Category }> = [
  {
    label: "⚽ Match result",
    question: "Will [Team A] beat [Team B] on [day]?",
    criteria: "[Team A] wins the match against [Team B] in normal time",
    source: "the Sports Council's official result sheet",
    category: "Football",
  },
  {
    label: "🗳️ Election",
    question: "Will [candidate] win the SUG presidential election?",
    criteria: "[candidate] is officially declared winner of the SUG presidential election",
    source: "the SUG Electoral Committee's official notice",
    category: "Campus Politics",
  },
  {
    label: "📄 Results release",
    question: "Will [department] results be released by [date]?",
    criteria: "[department] results for this semester appear on the result portal by [date]",
    source: "the official student result portal",
    category: "Exams & Results",
  },
  {
    label: "🎉 Event happens",
    question: "Will [event] hold on [date]?",
    criteria: "[event] takes place as scheduled on [date]",
    source: "the organisers' official social media page",
    category: "Events & Lifestyle",
  },
  {
    label: "🎤 Artist shows up",
    question: "Will [artist] perform at [event]?",
    criteria: "[artist] performs on stage at [event]",
    source: "the organisers' official social media page",
    category: "Entertainment & Music",
  },
  {
    label: "📢 Official announcement",
    question: "Will the school announce [decision] by [date]?",
    criteria: "the school officially announces [decision] on or before [date]",
    source: "the Registrar's official announcement",
    category: "Academics",
  },
];

export function ProposeForm({ schools, defaultSchool, allowGeneral = false }: { schools: School[]; defaultSchool: string; allowGeneral?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(proposeMarket, {});
  const v = state.values ?? {};
  const [school, setSchool] = useState(v.school_id && v.school_id !== GENERAL_SCHOOL_ID ? v.school_id : defaultSchool);
  const [general, setGeneral] = useState(allowGeneral && v.school_id === GENERAL_SCHOOL_ID);
  const [condition, setCondition] = useState(v.criteria ?? "");
  const [source, setSource] = useState(v.source ?? "");
  const [closesAt, setClosesAt] = useState(v.closes_at ?? "");
  const [question, setQuestion] = useState(v.question ?? "");
  const [category, setCategory] = useState<string>(v.category ?? CATEGORIES[0]);
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setQuestion(t.question);
    setCondition(t.criteria);
    setSource(t.source);
    setCategory(t.category);
    // Jump to the first blank so it can be typed over straight away.
    window.setTimeout(() => {
      const el = document.getElementById("question") as HTMLInputElement | null;
      const i = t.question.indexOf("[");
      if (el && i >= 0) {
        el.focus();
        el.setSelectionRange(i, t.question.indexOf("]", i) + 1);
      }
    }, 0);
  };

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
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Wand2 className="size-3.5 text-brand" /> Quick start
        </p>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium text-white transition hover:border-brand/50"
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Pick one, then replace the [blanks].</p>
      </div>
      <Field label="Market question" htmlFor="question" hint="A clear Yes/No question ending with '?'.">
        <input
          id="question"
          name="question"
          maxLength={160}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will the library open 24/7 during exam week?"
          className={inputCls}
        />
      </Field>

      <Field label="University" htmlFor="school_id">
        {allowGeneral && (
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1" role="radiogroup" aria-label="Who is this market for?">
            {[
              [false, "One university"],
              [true, "All universities"],
            ].map(([val, label]) => (
              <button
                key={String(val)}
                type="button"
                role="radio"
                aria-checked={general === val}
                onClick={() => setGeneral(val as boolean)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${general === val ? "bg-brand text-black" : "text-muted hover:text-white"}`}
              >
                {label as string}
              </button>
            ))}
          </div>
        )}
        {general ? (
          <>
            <input type="hidden" name="school_id" value={GENERAL_SCHOOL_ID} />
            <p className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5 text-sm text-white">
              Shows for every university, in everyone&apos;s feed and the <b>General</b> tab.
            </p>
          </>
        ) : (
          <SchoolCombobox
            id="school_id"
            name="school_id"
            schools={schools}
            value={school}
            onChange={setSchool}
            mySchoolId={defaultSchool}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Field label="Trading closes" htmlFor="closes_at" hint="Between 5 minutes and 120 days from now.">
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
        Goes live instantly.
      </p>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Publishing...">Publish market</SubmitButton>
    </form>
  );
}
