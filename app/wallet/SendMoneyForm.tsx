"use client";

import { AlertTriangle, AtSign, BadgeCheck, Info, Loader2, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { lookupMember, sendMoney, type P2PStatus } from "@/app/actions/wallet";
import { FormMessage, inputCls } from "@/components/forms";
import { useUI } from "@/context/UIContext";
import { formatNaira } from "@/lib/format";

/** Send money to another member by username. */
export function SendMoneyForm({ status }: { status: P2PStatus | null }) {
  const { toast } = useUI();
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<{ username: string; school: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [checking, startCheck] = useTransition();

  const kobo = Math.round((Number.parseFloat(amount) || 0) * 100);
  const sendable = status?.sendable_kobo ?? 0;
  const min = status?.min_kobo ?? 10_000;
  const cleanName = username.trim().replace(/^@/, "");

  // Look the username up shortly after typing stops, so the sender sees who they're paying.
  useEffect(() => {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanName)) return;
    const id = window.setTimeout(() => {
      startCheck(async () => {
        const res = await lookupMember(cleanName);
        if (res.ok) {
          setFound(res.value);
          setLookupError(null);
        } else {
          setFound(null);
          setLookupError(res.error);
        }
      });
    }, 450);
    return () => window.clearTimeout(id);
  }, [cleanName]);

  if (!status) return <p className="text-sm text-muted">Sending money isn&apos;t available yet.</p>;
  if (!status.eligible) {
    return (
      <div className="flex gap-2 rounded-xl bg-bg p-3 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>{status.reason}</p>
      </div>
    );
  }

  const blocker =
    !found ? "Enter a username" : kobo < min ? `Minimum ${formatNaira(min)}` : kobo > sendable ? `Up to ${formatNaira(sendable)} today` : null;

  const send = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await sendMoney(cleanName, kobo, note);
      if (!res.ok) return setError(res.error);
      toast(`Sent ${formatNaira(kobo)} to @${res.value}.`);
      setAmount("");
      setNote("");
    });
  };

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">
        You can send <span className="font-bold text-white">{formatNaira(sendable)}</span> today.
      </p>

      <div>
        <label htmlFor="send-to" className="mb-1.5 block text-xs font-semibold text-white">
          Username
        </label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id="send-to"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.replace(/\s/g, ""));
              setFound(null);
              setLookupError(null);
            }}
            placeholder="their_username"
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="mt-1.5 min-h-4 text-xs">
          {checking ? (
            <span className="text-muted">Checking...</span>
          ) : found ? (
            <span className="inline-flex items-center gap-1 text-yes">
              <BadgeCheck className="size-3.5" /> @{found.username}
              {found.school ? ` · ${found.school}` : ""}
            </span>
          ) : lookupError ? (
            <span className="text-no">{lookupError}</span>
          ) : null}
        </p>
      </div>

      <div>
        <label htmlFor="send-amount" className="mb-1.5 block text-xs font-semibold text-white">
          Amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">₦</span>
          <input
            id="send-amount"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputCls} py-3 pl-8 font-semibold tabular-nums`}
          />
        </div>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 80))}
        placeholder="Note (optional), e.g. for jollof"
        aria-label="Note"
        className={inputCls}
      />

      {error && <FormMessage error={error} />}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending || !!blocker}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "Sending..." : (blocker ?? `Send ${formatNaira(kobo)} to @${found?.username}`)}
      </button>

      {confirming && found && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-send-title">
          <div className="w-full animate-sheet-up rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-2xl">
            <p id="confirm-send-title" className="flex items-center gap-2 font-bold text-white">
              <AlertTriangle className="size-5 text-amber-300" /> Confirm transfer
            </p>
            <p className="mt-3 text-center text-3xl font-extrabold tabular-nums text-white">{formatNaira(kobo)}</p>
            <p className="text-center text-sm text-muted">
              to <span className="font-semibold text-white">@{found.username}</span>
              {found.school ? ` · ${found.school}` : ""}
            </p>
            {note.trim() && <p className="mt-1 text-center text-xs text-muted">&ldquo;{note.trim()}&rdquo;</p>}
            <ul className="mt-4 space-y-1.5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
              <li>• Transfers are instant and can&apos;t be reversed. Check the username carefully.</li>
              <li>• Never send money to someone promising to double it or to &ldquo;unlock&rdquo; anything. That&apos;s a scam.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-line py-3 text-sm font-semibold text-white hover:bg-card-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                className="rounded-xl bg-brand py-3 text-sm font-bold text-black transition hover:brightness-110"
              >
                Send {formatNaira(kobo)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
