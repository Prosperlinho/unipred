"use client";

import { BellRing, Check, Download, Loader2, Share } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { savePushSubscription } from "@/app/actions/notifications";
import { useUI } from "@/context/UIContext";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Registers the service worker once and remembers the browser's install prompt. Mount in the app shell. */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as InstallPromptEvent;
      emit();
    };
    const onInstalled = () => {
      deferredPrompt = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useInstallState() {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferredPrompt, () => false);
  const standalone = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
  const ios = useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );
  return { canPrompt, standalone, ios };
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Asks for permission (if needed), subscribes this device and saves it. Throws "blocked" if the user said no. */
export async function subscribeThisDevice(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("blocked");
  // Make sure our service worker is registered and active (don't wait forever if it isn't).
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js");
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Notifications took too long to start. Try again.")), 15_000)),
  ]);
  const { publicKey } = (await (await fetch("/api/push/key", { cache: "no-store" })).json()) as { publicKey: string };
  const key = urlBase64ToUint8Array(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // An old subscription made with a different key can't receive our messages: replace it.
  const oldKey = sub?.options.applicationServerKey;
  if (sub && oldKey && !sameBytes(new Uint8Array(oldKey), key)) {
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const res = await savePushSubscription(json);
  if (!res.ok) throw new Error(res.error);
}

/** "Get alerts on your phone" card: turn on push notifications and install the app. */
export function AlertsCard() {
  const { toast } = useUI();
  const { canPrompt, standalone, ios } = useInstallState();
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setPushOn(!!s && Notification.permission === "granted"))
      .catch(() => setPushOn(false));
  }, [supported]);

  const enablePush = async () => {
    setBusy(true);
    try {
      try {
        await subscribeThisDevice();
      } catch (e) {
        if (e instanceof Error && e.message === "blocked") {
          toast("Notifications are blocked. Allow them for unipred.site in your browser settings.", "error");
          return;
        }
        throw e;
      }
      setPushOn(true);
      toast("Phone notifications are on 🔔");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't turn on notifications.", "error");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
  };

  return (
    <section className="rounded-3xl border border-brand/30 bg-linear-to-br from-brand/10 to-card p-4">
      <p className="font-bold text-white">Never miss a result</p>
      <p className="mt-0.5 text-xs text-muted">Get a ping when you win, when a market you traded on is closing, and when new ones drop.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {supported && pushOn !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={pushOn ? undefined : enablePush}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${
              pushOn ? "border border-line text-white" : "bg-brand text-black hover:brightness-110"
            }`}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : pushOn ? <Check className="size-4" /> : <BellRing className="size-4" />}
            {pushOn ? "Phone alerts are on" : "Turn on phone alerts"}
          </button>
        )}
        {!standalone && canPrompt && (
          <button
            type="button"
            onClick={install}
            className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-bold text-white hover:bg-card-2"
          >
            <Download className="size-4" /> Add UniPred to home screen
          </button>
        )}
      </div>
      {!standalone && ios && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <Share className="mt-0.5 size-3.5 shrink-0" />
          On iPhone: tap Share in Safari, then &ldquo;Add to Home Screen&rdquo;. Open UniPred from there to turn on phone alerts.
        </p>
      )}
      {!supported && !ios && <p className="mt-2 text-xs text-muted">This browser doesn&apos;t support phone alerts. Try Chrome.</p>}
    </section>
  );
}
