"use client";

import { Handshake, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setPartnerRate } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";

export interface Partner {
  username: string;
  ratePct: number;
  joined: number;
  active: number;
}

/** Give big partners (entities, influencers) a special invite rate. */
export function PartnerPanel({ partners, standardPct }: { partners: Partner[]; standardPct: number }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [pct, setPct] = useState("");

  const save = (name: string, value: number | null) =>
    startTransition(async () => {
      const res = await setPartnerRate(name, value);
      toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
      if (res.ok && value !== null) {
        setUsername("");
        setPct("");
      }
    });

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">
        Everyone else earns the standard {standardPct}% of UniPred&apos;s fee on their invited friends&apos; trades. Partners earn
        the rate you set here, up to 100% of the fee. Like everyone, they only earn from friends who have done{" "}
        <b className="text-white">5 trades a day for 3 days in a row</b>.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
          placeholder="Partner's username"
          aria-label="Partner's username"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <div className="relative w-28 shrink-0">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="Rate"
            aria-label="Share of UniPred's fee, in percent"
            className={`${inputCls} pr-7`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
        </div>
        <button
          type="button"
          disabled={pending || !username || pct === ""}
          onClick={() => save(username.replace(/^@/, ""), Number(pct))}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />} Set rate
        </button>
      </div>
      {partners.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {partners.map((p) => (
            <li key={p.username} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-white">@{p.username}</span>{" "}
                <span className="font-bold text-brand">{p.ratePct}%</span>
                <span className="block text-xs text-muted">
                  {p.joined} invited · {p.active} active
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(p.username, null)}
                className="shrink-0 text-xs font-semibold text-muted hover:text-no disabled:opacity-50"
              >
                Back to {standardPct}%
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
