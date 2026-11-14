"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUI } from "@/context/UIContext";

interface Props {
  /** Path on this site, e.g. /markets/abc?side=YES&amount=1000 */
  path: string;
  /** Message placed before the link. */
  text: string;
  /** Logged-in username: added as ?ref= so sign-ups are credited to them. */
  refUsername?: string | null;
  label?: string;
  variant?: "button" | "icon" | "subtle";
}

function buildUrl(path: string, refUsername?: string | null): string {
  const url = new URL(path, window.location.origin);
  if (refUsername) url.searchParams.set("ref", refUsername);
  return url.toString();
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3ZM12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

export function ShareButton({ path, text, refUsername, label = "Share", variant = "button" }: Props) {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onClick = async () => {
    const url = buildUrl(path, refUsername);
    // Phones: use the native share sheet (WhatsApp, Telegram, SMS...).
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // User dismissed the sheet or sharing failed: fall back to the menu.
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    const url = buildUrl(path, refUsername);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
    setOpen(false);
  };

  const open_ = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const triggerCls =
    variant === "icon"
      ? "flex size-9 items-center justify-center rounded-xl border border-line bg-card text-muted transition hover:text-white"
      : variant === "subtle"
        ? "inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
        : "inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-white transition hover:bg-card-2";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button type="button" onClick={onClick} className={triggerCls} aria-label={label} aria-expanded={open}>
        {variant === "subtle" ? <Link2 className="size-3.5" /> : <Share2 className="size-4" />}
        {variant !== "icon" && label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-pop-in overflow-hidden rounded-xl border border-line bg-card-2 py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => open_(`https://wa.me/?text=${encodeURIComponent(`${text} ${buildUrl(path, refUsername)}`)}`)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-card"
          >
            <span className="text-[#25D366]">
              <WhatsAppIcon />
            </span>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() =>
              open_(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(buildUrl(path, refUsername))}`,
              )
            }
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-card"
          >
            <XIcon />X (Twitter)
          </button>
          <button type="button" onClick={copy} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-card">
            {copied ? <Check className="size-4 text-yes" /> : <Copy className="size-4" />}
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
