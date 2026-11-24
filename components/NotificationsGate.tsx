"use client";

import { Loader2, Share } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { subscribeThisDevice, useInstallState } from "./AppAlerts";
import { LogoTile } from "./Logo";
import { TOUR_STATE_EVENT } from "./Tour";

/**
 * Compulsory phone notifications: a logged-in member can't use UniPred until this device has
 * notifications turned on. If they blocked them, they stay here until they allow them in their
 * browser settings. iPhone Safari can't do notifications until UniPred is added to the Home Screen,
 * so there (and only there) they may continue for now. It waits while the app tour is running.
 */
type State = "checking" | "ok" | "ask" | "blocked" | "ios" | "unsupported";

const OPEN_PATHS = ["/rules", "/terms", "/privacy"];
const IOS_SKIP_KEY = "unipred_ios_notify_later";
const SYNCED_KEY = "unipred_push_synced";
const SKIP_KEY = "unipred_notify_failed_skip";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private mode: fine, we'll just check again next time.
  }
}

export function NotificationsGate() {
  const pathname = usePathname();
  const { ios, standalone } = useInstallState();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [tourBusy, setTourBusy] = useState(false);

  // Wait our turn while the app tour is on screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTourBusy(!!(window as Window & { __unipredTour?: boolean }).__unipredTour);
    const on = (e: Event) => setTourBusy(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(TOUR_STATE_EVENT, on);
    return () => window.removeEventListener(TOUR_STATE_EVENT, on);
  }, []);

  const check = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      if (ios && !standalone) return setState(readSession(IOS_SKIP_KEY) ? "ok" : "ios");
      return setState("unsupported");
    }
    if (readSession(SKIP_KEY)) return setState("ok");
    if (Notification.permission === "denied") return setState("blocked");
    if (Notification.permission === "default") return setState("ask");
    // Permission granted: make sure this device is subscribed and saved on our side (once per visit).
    if (readSession(SYNCED_KEY)) return setState("ok");
    try {
      await subscribeThisDevice(); // no prompt: permission is already granted
      writeSession(SYNCED_KEY, "1");
      setState("ok");
    } catch {
      setState("ask");
    }
  }, [ios, standalone]);

  useEffect(() => {
    // Async check of the browser's permission + subscription; state is set once it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    // Re-check when they come back from their settings app.
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        status = s;
        s.onchange = () => void check();
      })
      .catch(() => undefined);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (status) status.onchange = null;
    };
  }, [check]);

  const blocking = state !== "ok" && state !== "checking" && !tourBusy && !OPEN_PATHS.includes(pathname);

  useEffect(() => {
    if (!blocking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [blocking]);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeThisDevice();
      writeSession(SYNCED_KEY, "1");
      setState("ok");
    } catch (e) {
      if (e instanceof Error && e.message === "blocked") {
        setState(Notification.permission === "denied" ? "blocked" : "ask");
      } else {
        setFailures((n) => n + 1);
        setError("Your phone couldn't finish turning on notifications. Check your internet and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!blocking) return null;

  const title = state === "ios" ? "Get UniPred on your Home Screen" : "Allow notifications from UniPred";

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="notify-title">
      <div className="w-full rounded-t-[28px] bg-[#f6f7f5] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#0b1f16] shadow-2xl sm:max-w-sm sm:rounded-[28px]">
        <div className="flex flex-col items-center text-center">
          <LogoTile className="size-16 rounded-2xl shadow-md" />
          <h2 id="notify-title" className="mt-3 text-lg font-extrabold leading-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-[#4b5a52]">Required to use UniPred. We only send what matters to your trades.</p>
        </div>

        {/* What a notification looks like */}
        <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start gap-2.5">
            <LogoTile className="mt-0.5 size-8 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-[11px] text-[#6b7a72]">
                <span className="font-semibold">UniPred</span>
                <span>now</span>
              </p>
              <p className="text-sm font-bold">You won ₦4,500</p>
              <p className="truncate text-xs text-[#4b5a52]">&ldquo;Will GST 101 hold by 1pm?&rdquo; resolved YES. Paid to your wallet.</p>
            </div>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-[#24352c]">
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#0b1f16]" />Results and payouts the moment a market settles</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#0b1f16]" />Reminders before your markets close</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#0b1f16]" />Deposits, withdrawals and new markets at your school</li>
        </ul>

        {state === "ask" && (
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b1f16] py-3.5 font-bold text-white transition hover:bg-black disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Turning on…" : "Allow notifications"}
          </button>
        )}

        {state === "blocked" && (
          <>
            <div className="mt-4 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/5">
              <p className="font-bold">Notifications are blocked on this phone</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs text-[#4b5a52]">
                <li>Tap the icon on the left of unipred.site in the address bar.</li>
                <li>Open &ldquo;Permissions&rdquo; or &ldquo;Site settings&rdquo;.</li>
                <li>Set Notifications to &ldquo;Allow&rdquo;, then come back here.</li>
              </ol>
              <p className="mt-1.5 text-xs text-[#6b7a72]">Using the installed app? Phone Settings → Apps → UniPred → Notifications → On.</p>
            </div>
            <button
              type="button"
              onClick={() => void check()}
              className="mt-4 w-full rounded-2xl bg-[#0b1f16] py-3.5 font-bold text-white transition hover:bg-black"
            >
              I&apos;ve allowed them
            </button>
          </>
        )}

        {state === "ios" && (
          <>
            <div className="mt-4 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/5">
              <p className="flex items-center gap-1.5 font-bold">
                <Share className="size-4" /> On iPhone, notifications need the app
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs text-[#4b5a52]">
                <li>Tap the Share button at the bottom of Safari.</li>
                <li>Choose &ldquo;Add to Home Screen&rdquo;, then &ldquo;Add&rdquo;.</li>
                <li>Open UniPred from your Home Screen and allow notifications.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => {
                writeSession(IOS_SKIP_KEY, "1");
                setState("ok");
              }}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-[#24352c] ring-1 ring-black/10 hover:bg-black/5"
            >
              Continue for now
            </button>
          </>
        )}

        {state === "unsupported" && (
          <p className="mt-4 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/5">
            This browser can&apos;t show notifications. Open <b>unipred.site</b> in <b>Chrome</b> to continue. Came from WhatsApp, Instagram
            or X? Tap the menu (⋮) and choose &ldquo;Open in browser&rdquo;.
          </p>
        )}

        {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}
        {failures >= 2 && state === "ask" && (
          <button
            type="button"
            onClick={() => {
              writeSession(SKIP_KEY, "1");
              setState("ok");
            }}
            className="mt-2 w-full py-2 text-xs font-semibold text-[#6b7a72] underline"
          >
            Still not working? Continue for now
          </button>
        )}
      </div>
    </div>
  );
}
