"use client";

import { Check, Copy, Globe, KeyRound, Loader2, Lock, LogOut, Plus, Share2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelRoomQuestion,
  createRoom,
  dropRoomQuestion,
  joinRoom,
  leaveRoom,
  resolveRoomQuestion,
} from "@/app/actions/rooms";
import { inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { CATEGORIES, type Outcome } from "@/lib/types";

/** Create a room (anyone can). */
export function CreateRoomForm() {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-bold text-black transition hover:brightness-110"
      >
        <Plus className="size-5" strokeWidth={3} /> Create a room
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-brand/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-white">New room</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-white" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="Room name, e.g. Hall 3 Ballers" className={inputCls} aria-label="Room name" />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={200}
        placeholder="What's it about? (optional)"
        className={inputCls}
        aria-label="Description"
      />
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, label: "Public", sub: "Anyone can join", Icon: Globe },
          { v: false, label: "Private", sub: "Invite link only", Icon: Lock },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setIsPublic(o.v)}
            aria-pressed={isPublic === o.v}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${isPublic === o.v ? "border-brand bg-brand/10" : "border-line"}`}
          >
            <o.Icon className={`size-4 ${isPublic === o.v ? "text-brand" : "text-muted"}`} />
            <span>
              <span className="block text-sm font-semibold text-white">{o.label}</span>
              <span className="text-[11px] text-muted">{o.sub}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={pending || name.trim().length < 3}
        onClick={() =>
          startTransition(async () => {
            const res = await createRoom(name, description, isPublic);
            if (!res.ok) return toast(res.error, "error");
            router.push(`/rooms/${res.value}`);
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Create room
      </button>
    </div>
  );
}

/** Join a private room by typing its invite code. */
export function JoinByCode() {
  const router = useRouter();
  const { toast } = useUI();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          placeholder="Invite code"
          aria-label="Invite code"
          className={`${inputCls} pl-9 font-mono tracking-widest`}
        />
      </div>
      <button
        type="button"
        disabled={pending || code.length < 8}
        onClick={() =>
          startTransition(async () => {
            const res = await joinRoom(null, code);
            if (!res.ok) return toast(res.error, "error");
            router.push(`/rooms/${res.value}`);
          })
        }
        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Join
      </button>
    </div>
  );
}

export function JoinLeaveButton({ roomId, member, isHost }: { roomId: string; member: boolean; isHost: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [pending, startTransition] = useTransition();
  if (isHost) return null;
  return member ? (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm("Leave this room?") &&
        startTransition(async () => {
          const res = await leaveRoom(roomId);
          if (!res.ok) return toast(res.error, "error");
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted hover:text-white"
    >
      <LogOut className="size-3.5" /> Leave
    </button>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await joinRoom(roomId, null);
          if (!res.ok) return toast(res.error, "error");
          toast("You're in! 🎉");
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Join room
    </button>
  );
}

/** Copy or share the room's invite link. */
export function InviteBox({ link, code, roomName }: { link: string; code: string; roomName: string }) {
  const { toast } = useUI();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: roomName, text: `Join my UniPred room "${roomName}" and call it with us:`, url: link }).catch(() => undefined);
    } else {
      await copy();
      toast("Invite link copied");
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-wide text-muted">Invite code</span>
        <span className="font-mono text-sm font-bold tracking-widest text-white">{code}</span>
      </span>
      <button type="button" onClick={copy} className="rounded-lg p-2 text-muted hover:text-white" aria-label="Copy invite link">
        {copied ? <Check className="size-4 text-yes" /> : <Copy className="size-4" />}
      </button>
      <button type="button" onClick={share} className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-black">
        <Share2 className="size-3.5" /> Invite
      </button>
    </div>
  );
}

const CLOSE_OPTIONS = [
  { label: "30 min", mins: 30 },
  { label: "1 hour", mins: 60 },
  { label: "3 hours", mins: 180 },
  { label: "6 hours", mins: 360 },
  { label: "Tonight (12h)", mins: 720 },
  { label: "1 day", mins: 1440 },
  { label: "3 days", mins: 4320 },
  { label: "1 week", mins: 10080 },
];

/** Host-only: drop a YES/NO question into the room. */
export function DropQuestion({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [question, setQuestion] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<string>("Events & Lifestyle");
  const [mins, setMins] = useState(180);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2 rounded-2xl border border-brand/30 bg-linear-to-br from-brand/10 to-card p-4">
      <p className="font-bold text-white">Drop a question</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={160}
        placeholder="Will Tunde show up to the 8am class?"
        aria-label="Question"
        className={inputCls}
      />
      <input
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={200}
        placeholder="How YES is decided (optional), e.g. he's in class before 8:15"
        aria-label="Details"
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} aria-label="Category">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={mins} onChange={(e) => setMins(Number(e.target.value))} className={inputCls} aria-label="Betting closes in">
          {CLOSE_OPTIONS.map((o) => (
            <option key={o.mins} value={o.mins}>
              Closes in {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={pending || question.trim().length < 8}
        onClick={() =>
          startTransition(async () => {
            const q = question.trim().endsWith("?") ? question.trim() : `${question.trim()}?`;
            const res = await dropRoomQuestion(roomId, q, details, category, new Date(Date.now() + mins * 60_000).toISOString());
            if (!res.ok) return toast(res.error, "error");
            toast("Question is live 🔥");
            setQuestion("");
            setDetails("");
            router.refresh();
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 font-bold text-black disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Post to room
      </button>
    </div>
  );
}

/** Host-only: decide the result of a closed question, or cancel and refund. */
export function HostResolve({ marketId, roomId }: { marketId: string; roomId: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [confirming, setConfirming] = useState<Outcome | "CANCEL" | null>(null);
  const [pending, startTransition] = useTransition();
  const go = (c: Outcome | "CANCEL") => {
    if (confirming !== c) return setConfirming(c);
    setConfirming(null);
    startTransition(async () => {
      const res = c === "CANCEL" ? await cancelRoomQuestion(marketId, roomId) : await resolveRoomQuestion(marketId, c, roomId);
      toast(res.ok ? res.value : res.error, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["YES", "NO", "CANCEL"] as const).map((c) => (
        <button
          key={c}
          type="button"
          disabled={pending}
          onClick={() => go(c)}
          className={`rounded-xl py-2 text-xs font-bold transition disabled:opacity-50 ${
            confirming === c
              ? c === "YES"
                ? "bg-yes text-black"
                : c === "NO"
                  ? "bg-no text-black"
                  : "bg-white text-black"
              : c === "YES"
                ? "bg-yes/15 text-yes"
                : c === "NO"
                  ? "bg-no/15 text-no"
                  : "border border-line text-muted"
          }`}
        >
          {confirming === c ? "Tap to confirm" : c === "CANCEL" ? "Cancel & refund" : `It's ${c}`}
        </button>
      ))}
    </div>
  );
}
