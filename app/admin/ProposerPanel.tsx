"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setProposerAccess } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";

/** Grant or remove the right to propose markets. Admins can always propose. */
export function ProposerPanel({ proposers }: { proposers: string[] }) {
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");

  const save = (name: string, allow: boolean) =>
    startTransition(async () => {
      const res = await setProposerAccess(name, allow);
      toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
      if (res.ok && allow) setUsername("");
    });

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">
        Only the members listed here (and admins) can create markets. Everyone else sees an &ldquo;invitation only&rdquo;
        page.
      </p>
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
          placeholder="Username to give access"
          aria-label="Username to give proposing access"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          type="button"
          disabled={pending || !username}
          onClick={() => save(username, true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Give access
        </button>
      </div>
      {proposers.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {proposers.map((u) => (
            <li key={u} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-semibold text-white">@{u}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(u, false)}
                className="text-xs font-semibold text-muted hover:text-no disabled:opacity-50"
              >
                Remove access
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No members have access yet. Only admins can propose.</p>
      )}
    </div>
  );
}
