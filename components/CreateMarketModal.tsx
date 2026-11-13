"use client";

import { AlertCircle, ShieldCheck } from "lucide-react";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { formatCP, toLocalInputValue } from "@/lib/format";
import { CREATOR_BOND, DAY_MS, MIN_LIQUIDITY } from "@/lib/mock-data";
import { CATEGORIES, type Category } from "@/lib/types";
import { Sheet } from "./Sheet";

const inputCls =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none";

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: ReactNode }) {
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

function CreateForm({ onDone }: { onDone: () => void }) {
  const { balance, createMarket } = useMarkets();
  const { toast, openMarket } = useUI();
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<Category>("Campus Politics");
  const [criteria, setCriteria] = useState("");
  const [source, setSource] = useState("");
  const [closesAt, setClosesAt] = useState(() => toLocalInputValue(Date.now() + 3 * DAY_MS));
  const [minDate] = useState(() => toLocalInputValue(Date.now() + 15 * 60_000));
  const [liquidity, setLiquidity] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const liq = Number.parseFloat(liquidity);
  const liqValid = Number.isFinite(liq) ? liq : 0;
  const total = liqValid + CREATOR_BOND;
  const affordable = total <= balance + 1e-9;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = createMarket({
      question,
      category,
      criteria,
      source,
      closesAt: new Date(closesAt).getTime(),
      liquidity: liqValid,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(`Market live! ${formatCP(total)} CP locked (liquidity + bond).`);
    onDone();
    openMarket(res.value, { tab: "trade" });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Market question" htmlFor="cm-question" hint="Must be answerable with Yes or No and end with '?'.">
        <input
          id="cm-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 150))}
          placeholder="Will the library open 24/7 during exam week?"
          className={inputCls}
          required
        />
      </Field>

      <Field label="Category" htmlFor="cm-category">
        <select
          id="cm-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Resolution criteria" htmlFor="cm-criteria" hint="Exactly what makes this resolve YES vs NO.">
        <textarea
          id="cm-criteria"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value.slice(0, 600))}
          rows={3}
          placeholder="Resolves YES if the University Librarian officially announces 24-hour opening for exam week..."
          className={`${inputCls} resize-none`}
          required
        />
      </Field>

      <Field label="Resolution source" htmlFor="cm-source">
        <input
          id="cm-source"
          value={source}
          onChange={(e) => setSource(e.target.value.slice(0, 160))}
          placeholder="Library notice board / official university website"
          className={inputCls}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resolution date & time" htmlFor="cm-date">
          <input
            id="cm-date"
            type="datetime-local"
            value={closesAt}
            min={minDate}
            onChange={(e) => setClosesAt(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`}
            required
          />
        </Field>
        <Field label="Initial liquidity (CP)" htmlFor="cm-liquidity" hint={`Minimum ${MIN_LIQUIDITY} CP. Starts at 50/50.`}>
          <input
            id="cm-liquidity"
            type="number"
            inputMode="numeric"
            min={MIN_LIQUIDITY}
            step="1"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            className={inputCls}
            required
          />
        </Field>
      </div>

      <div className="space-y-1 rounded-xl border border-line bg-card p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Initial liquidity</span>
          <span className="tabular-nums text-white">{formatCP(liqValid)} CP</span>
        </div>
        <div className="flex justify-between">
          <span className="inline-flex items-center gap-1 text-muted">
            <ShieldCheck className="size-3.5" /> Anti-spam creator bond
          </span>
          <span className="tabular-nums text-white">{CREATOR_BOND} CP</span>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
          <span className="text-white">Total deducted</span>
          <span className={`tabular-nums ${affordable ? "text-white" : "text-no"}`}>{formatCP(total)} CP</span>
        </div>
        <p className="pt-1 text-[11px] text-muted">
          The bond is refunded when you resolve the market. Balance: {formatCP(balance)} CP
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-no" role="alert">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!affordable}
        className="w-full rounded-xl bg-brand py-3.5 font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {affordable ? "Launch Market" : "Insufficient balance"}
      </button>
    </form>
  );
}

export function CreateMarketModal() {
  const { createOpen, setCreateOpen } = useUI();
  const close = useCallback(() => setCreateOpen(false), [setCreateOpen]);
  return (
    <Sheet open={createOpen} onClose={close} title="Create a market" wide>
      {createOpen && <CreateForm onDone={close} />}
    </Sheet>
  );
}
