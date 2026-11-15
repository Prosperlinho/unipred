"use client";

import { Loader2, ScrollText } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { acceptTerms } from "@/app/actions/settings";

/**
 * Blocking popup: a logged-in user must scroll through and accept the house rules
 * before they can use anything else. The database enforces the same rule.
 */
/** Pages that must stay readable while the gate is up. */
const OPEN_PATHS = ["/rules", "/terms", "/privacy"];

export function RulesGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const exempt = OPEN_PATHS.includes(pathname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (exempt) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [exempt]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true);
  };

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptTerms();
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  };

  if (exempt) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="flex max-h-[94dvh] w-full flex-col rounded-t-2xl border border-line bg-bg sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <ScrollText className="size-5 text-brand" />
          <div>
            <h2 id="rules-title" className="font-bold text-white">
              Before you start: House Rules
            </h2>
            <p className="text-xs text-muted">Please read to the end. You need to accept these to use UniPred.</p>
          </div>
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        <div className="space-y-3 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <label className={`flex items-start gap-2 text-sm ${readToEnd ? "text-white" : "text-muted"}`}>
            <input
              type="checkbox"
              disabled={!readToEnd}
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span>
              I&apos;m 18 or older, I&apos;ve read the House Rules and I accept them together with the Terms and Privacy
              Policy.
            </span>
          </label>
          {!readToEnd && <p className="text-xs text-amber-300">Scroll to the bottom of the rules to continue.</p>}
          {error && <p className="text-sm text-no">{error}</p>}
          <button
            type="button"
            disabled={!checked || pending}
            onClick={accept}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-card-2 disabled:text-muted"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            I accept, take me in
          </button>
        </div>
      </div>
    </div>
  );
}
