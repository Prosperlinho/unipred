"use client";

import { MessagesSquare, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { timeAgo } from "@/lib/format";
import type { Market, Outcome } from "@/lib/types";

const MAX_LEN = 280;

function SideChip({ side }: { side: Outcome | null }) {
  if (!side) return null;
  return (
    <span
      className={`rounded px-1.5 py-px text-[10px] font-bold ${
        side === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
      }`}
    >
      {side}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 _.]/g, "").split(/[ _.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Comments({ market, now }: { market: Market; now: number }) {
  const { addComment, getPosition } = useMarkets();
  const { toast } = useUI();
  const [text, setText] = useState("");
  const holdsYes = (getPosition(market.id, "YES")?.shares ?? 0) > 0;
  const holdsNo = (getPosition(market.id, "NO")?.shares ?? 0) > 0;
  const [side, setSide] = useState<Outcome | null>(holdsYes && !holdsNo ? "YES" : holdsNo && !holdsYes ? "NO" : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = addComment(market.id, text, side);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setText("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-xl border border-line bg-card p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          placeholder="Drop your hot take... (keep it civil, no dey insult person)"
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
          aria-label="Write a comment"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Your stance">
            {([null, "YES", "NO"] as const).map((s) => (
              <button
                key={s ?? "neutral"}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => setSide(s)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  side === s
                    ? s === "YES"
                      ? "bg-yes text-black"
                      : s === "NO"
                        ? "bg-no text-black"
                        : "bg-white text-black"
                    : "text-muted hover:text-white"
                }`}
              >
                {s ?? "Neutral"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-muted">
              {text.length}/{MAX_LEN}
            </span>
            <button
              type="submit"
              disabled={!text.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40"
            >
              <Send className="size-3.5" /> Post
            </button>
          </div>
        </div>
      </form>

      {market.comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
          <MessagesSquare className="size-7" />
          No banter yet. Start the argument.
        </div>
      ) : (
        <ul className="space-y-3">
          {market.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  c.isUser ? "bg-brand text-black" : "bg-card-2 text-white"
                }`}
                aria-hidden
              >
                {initials(c.author)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`font-semibold ${c.isUser ? "text-brand" : "text-white"}`}>{c.author}</span>
                  <SideChip side={c.side} />
                  <span className="text-muted">· {timeAgo(c.createdAt, now)}</span>
                </div>
                <p className="mt-0.5 break-words text-sm leading-relaxed text-white/90">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
