"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { setInterests } from "@/app/actions/settings";
import { CATEGORIES, type Category } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";

const KEY = "unipred_interests";
const EVENT = "unipred:interests";

function readLocal(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/**
 * The categories this person wants: saved on their profile when logged in, in the browser otherwise.
 * undefined = still loading (server render), null = not chosen yet.
 */
export function useInterests(saved: string[] | null | undefined, loggedIn: boolean): Category[] | null | undefined {
  const local = useSyncExternalStore(subscribe, readLocal, () => undefined as unknown as string | null);
  if (loggedIn) return (saved ?? null) as Category[] | null;
  if (local === undefined) return undefined;
  if (!local) return null;
  try {
    return JSON.parse(local) as Category[];
  } catch {
    return null;
  }
}

export function openInterestPicker() {
  window.dispatchEvent(new Event("unipred:pick-interests"));
}

/** Full-screen "what are you into?" picker. Shows by itself until a choice is saved. */
export function InterestPicker({ current, loggedIn }: { current: Category[] | null | undefined; loggedIn: boolean }) {
  const router = useRouter();
  const [forced, setForced] = useState(false);
  const [picked, setPicked] = useState<Category[]>(current ?? []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = current === null || forced;

  useEffect(() => {
    const onOpen = () => {
      setPicked(current ?? []);
      setForced(true);
    };
    window.addEventListener("unipred:pick-interests", onOpen);
    return () => window.removeEventListener("unipred:pick-interests", onOpen);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const toggle = (c: Category) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const save = (list: Category[]) => {
    setError(null);
    if (!loggedIn) {
      localStorage.setItem(KEY, JSON.stringify(list));
      window.dispatchEvent(new Event(EVENT));
      setForced(false);
      return;
    }
    startTransition(async () => {
      const res = await setInterests(list);
      if (!res.ok) return setError(res.error);
      setForced(false);
      router.refresh();
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="interests-title">
      <div className="w-full animate-sheet-up rounded-t-3xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-3xl">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
          <Sparkles className="size-4" /> Your feed
        </p>
        <h2 id="interests-title" className="mt-1 text-2xl font-extrabold text-white">
          What are you into?
        </h2>
        <p className="mt-1 text-sm text-muted">Pick what you want to trade. Change it any time.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = picked.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                aria-pressed={on}
                className={`relative rounded-full transition active:scale-95 ${on ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100"}`}
              >
                <span className="pointer-events-none block scale-110 px-1 py-1">
                  <CategoryBadge category={c} />
                </span>
                {on && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand text-black">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-no">{error}</p>}

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => save([...CATEGORIES])}
            disabled={pending}
            className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white hover:bg-card"
          >
            Show me all
          </button>
          <button
            type="button"
            onClick={() => save(picked)}
            disabled={pending || picked.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {picked.length ? `Continue (${picked.length})` : "Pick at least one"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
