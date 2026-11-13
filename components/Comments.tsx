"use client";

import { Loader2, MessagesSquare, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { deleteComment, postComment } from "@/app/actions/market";
import { useUI } from "@/context/UIContext";
import { initials, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { CommentView, Outcome } from "@/lib/types";

const MAX_LEN = 280;

interface Props {
  marketId: string;
  comments: CommentView[];
  loggedIn: boolean;
  defaultSide: Outcome | null;
  serverNow: number;
}

export function Comments({ marketId, comments, loggedIn, defaultSide, serverNow }: Props) {
  const { toast } = useUI();
  const now = useNow(serverNow);
  const [text, setText] = useState("");
  const [side, setSide] = useState<Outcome | null>(defaultSide);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await postComment(marketId, text, side);
      if (!res.ok) return toast(res.error, "error");
      setText("");
    });
  };

  const remove = (id: number) => {
    startTransition(async () => {
      const res = await deleteComment(marketId, id);
      if (!res.ok) toast(res.error, "error");
    });
  };

  return (
    <div className="space-y-4">
      {loggedIn ? (
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
                disabled={!text.trim() || pending}
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Post
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-line bg-card p-3 text-center text-sm text-muted">
          <Link href={`/login?next=/markets/${marketId}`} className="font-semibold text-brand hover:underline">
            Log in
          </Link>{" "}
          to join the banter.
        </p>
      )}

      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
          <MessagesSquare className="size-7" />
          No banter yet. Start the argument.
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  c.isMine ? "bg-brand text-black" : "bg-card-2 text-white"
                }`}
                aria-hidden
              >
                {initials(c.username)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`font-semibold ${c.isMine ? "text-brand" : "text-white"}`}>@{c.username}</span>
                  {c.side && (
                    <span
                      className={`rounded px-1.5 py-px text-[10px] font-bold ${
                        c.side === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                      }`}
                    >
                      {c.side}
                    </span>
                  )}
                  <span className="text-muted">· {timeAgo(new Date(c.created_at).getTime(), now)}</span>
                  {c.isMine && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto rounded p-1 text-muted opacity-60 transition hover:text-no group-hover:opacity-100"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 break-words text-sm leading-relaxed text-white/90">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
