"use client";

import { BellRing, Loader2, Settings, Share } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { subscribeThisDevice, useInstallState } from "./AppAlerts";

/**
 * Compulsory phone notifications: a logged-in member can't use UniPred until this device has
 * notifications turned on. If they blocked them, they stay here until they allow them in their
 * browser settings. iPhone Safari can't do notifications until UniPred is added to the Home Screen,
 * so there (and only there) they may continue for now.
 */
type State = "checking" | "ok" | "ask" | "blocked" | "ios" | "unsupported";

const OPEN_PATHS = ["/rules", "/terms", "/privacy"];
const IOS_SKIP_KEY = "unipred_ios_notify_later";
const SYNCED_KEY = "unipred_push_synced";

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

  const check = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      if (ios && !standalone) return setState(readSession(IOS_SKIP_KEY) ? "ok" : "ios");
      return setState("unsupported");
    }
    if (Notification.permission === "denied") return setState("blocked");
    if (Notification.permission === "default") return setState("ask");
    // Permission granted: make sure this device is subscribed and saved on our side.
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setState("ask");
      if (!readSession(SYNCED_KEY)) {
        await subscribeThisDevice(); // re-saves the same subscription (no prompt: already granted)
        writeSession(SYNCED_KEY, "1");
      }
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

  const blocking = state !== "ok" && state !== "checking" && !OPEN_PATHS.includes(pathname);

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
      if (e instanceof Error && e.message === "blocked") setState(Notification.permission === "denied" ? "blocked" : "ask");
      else setError(e instanceof Error ? e.message : "Couldn't turn on notifications. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!blocking) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="notify-title">
      <div className="w-full rounded-t-3xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <BellRing className="size-6" />
        </span>
        <h2 id="notify-title" className="mt-3 text-xl font-extrabold text-white">
          Turn on notifications
        </h2>
        <p className="mt-1 text-sm text-muted">
          UniPred needs notifications on to tell you when you win, when your markets are closing and when new ones drop. You need to turn
          them on to continue.
        </p>

        {state === "ask" && (
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-extrabold text-black transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
            Turn on notifications
          </button>
        )}

        {state === "blocked" && (
          <>
            <div className="mt-4 rounded-2xl border border-no/30 bg-no/10 p-3 text-sm text-white">
              <p className="flex items-center gap-1.5 font-bold">
                <Settings className="size-4 text-no" /> Notifications are blocked for UniPred
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/85">
                <li>Tap the lock or settings icon next to unipred.site in the address bar.</li>
                <li>Open &ldquo;Permissions&rdquo; or &ldquo;Site settings&rdquo;.</li>
                <li>Set Notifications to &ldquo;Allow&rdquo;, then come back here.</li>
              </ol>
              <p className="mt-2 text-xs text-muted">
                Installed app? Go to your phone&apos;s Settings → Apps → UniPred (or Chrome) → Notifications and turn them on.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void check()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-extrabold text-black transition hover:brightness-110"
            >
              I&apos;ve turned them on
            </button>
          </>
        )}

        {state === "ios" && (
          <>
            <div className="mt-4 rounded-2xl border border-line bg-card p-3 text-sm text-white">
              <p className="flex items-center gap-1.5 font-bold">
                <Share className="size-4 text-brand" /> On iPhone, add UniPred to your Home Screen
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/85">
                <li>Tap the Share button at the bottom of Safari.</li>
                <li>Choose &ldquo;Add to Home Screen&rdquo;, then &ldquo;Add&rdquo;.</li>
                <li>Open UniPred from your Home Screen and turn on notifications.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => {
                writeSession(IOS_SKIP_KEY, "1");
                setState("ok");
              }}
              className="mt-4 w-full rounded-xl border border-line py-3 text-sm font-semibold text-white hover:bg-card-2"
            >
              Continue for now
            </button>
          </>
        )}

        {state === "unsupported" && (
          <p className="mt-4 rounded-2xl border border-line bg-card p-3 text-sm text-white">
            This browser can&apos;t show notifications. Open <b>unipred.site</b> in <b>Chrome</b> (or your phone&apos;s main browser) to
            continue. If you came from WhatsApp, Instagram or X, tap the menu (⋮) and choose &ldquo;Open in browser&rdquo;.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-no">{error}</p>}
      </div>
    </div>
  );
}
