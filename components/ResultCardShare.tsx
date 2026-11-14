"use client";

import { Download, ImageIcon, Loader2, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "@/context/UIContext";

interface Props {
  marketId: string;
  /** "won" | "lost" | "backing": only used for the button label and file name. */
  kind: "won" | "lost" | "backing";
  /** Caption used when sharing, e.g. "I just won ₦3,073 on UniPred". */
  caption: string;
  refUsername: string;
}

function marketUrl(marketId: string, ref: string) {
  const u = new URL(`/markets/${marketId}`, window.location.origin);
  u.searchParams.set("ref", ref);
  return u.toString();
}

export function ResultCardShare({ marketId, kind, caption, refUsername }: Props) {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const src = `/api/card/${marketId}?v=${version}`;
  const fileName = `unipred-${kind}-${marketId.slice(0, 8)}.png`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const getFile = async (): Promise<File> => {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    return new File([blob], fileName, { type: "image/png" });
  };

  const download = async () => {
    setBusy(true);
    try {
      const file = await getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Card saved to your device");
    } catch {
      toast("Couldn't create the card. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const shareImage = async () => {
    setBusy(true);
    try {
      const file = await getFile();
      const text = `${caption} ${marketUrl(marketId, refUsername)}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        toast("Your browser can't share images directly. Download the card, then attach it.", "info");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast("Sharing failed. Try Download instead.", "error");
    } finally {
      setBusy(false);
    }
  };

  const openLink = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const shareLinks = () => {
    const url = marketUrl(marketId, refUsername);
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${caption} ${url}`)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(caption)}`,
    };
  };

  const label = kind === "won" ? "Share my win" : kind === "lost" ? "Share my L" : "Share my bet card";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setVersion(Date.now());
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          kind === "won" ? "bg-yes text-black hover:brightness-110" : "border border-line text-white hover:bg-card-2"
        }`}
      >
        <ImageIcon className="size-3.5" /> {label}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Your card">
            <button type="button" aria-label="Close" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 animate-fade-in bg-black/75" />
            <div className="relative max-h-[92dvh] w-full animate-sheet-up overflow-y-auto rounded-t-2xl border border-line bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:animate-pop-in sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-white">Your card</p>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted hover:text-white" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element -- generated per user, not a static asset */}
              <img src={src} alt="Your UniPred result card" className="aspect-square w-full rounded-xl border border-line bg-card" />

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-bold text-white transition hover:bg-card-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download
                </button>
                <button
                  type="button"
                  onClick={shareImage}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                >
                  <Share2 className="size-4" /> Share image
                </button>
              </div>

              <p className="mb-2 mt-4 text-xs text-muted">Or post a link (attach the downloaded card for the full effect):</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openLink(shareLinks().whatsapp)}
                  className="rounded-xl bg-[#25D366]/15 py-2.5 text-sm font-semibold text-[#25D366] hover:bg-[#25D366]/25"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => openLink(shareLinks().x)}
                  className="rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={() => openLink(shareLinks().telegram)}
                  className="rounded-xl bg-[#2AABEE]/15 py-2.5 text-sm font-semibold text-[#2AABEE] hover:bg-[#2AABEE]/25"
                >
                  Telegram
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
