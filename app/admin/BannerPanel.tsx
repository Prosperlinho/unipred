"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createBanner, deleteBanner, setBannerActive } from "@/app/actions/admin";
import { inputCls } from "@/components/forms";
import { SponsorBanner } from "@/components/SponsorBanner";
import { useUI } from "@/context/UIContext";
import type { BannerPlacement, SponsorBanner as Banner } from "@/lib/types";

const PLACES: Array<{ id: BannerPlacement; label: string }> = [
  { id: "home", label: "Home (under the swipe deck)" },
  { id: "markets", label: "Markets page (top)" },
  { id: "leaderboard", label: "Leaderboard (under the prize pool)" },
];

/** Resizes an image to at most 1600px wide and re-encodes it as WebP, so uploads stay small (~100-300KB). */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file; // keep animations
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Create sponsor banners (with live preview) and manage existing ones. */
export function BannerPanel({ banners, now }: { banners: Banner[]; now: number }) {
  const { toast } = useUI();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState({ sponsor: "", title: "", description: "", cta: "", link: "", image: "" });
  const set = (k: keyof typeof preview, v: string) => setPreview((p) => ({ ...p, [k]: v }));

  const previewBanner: Banner = {
    id: "preview",
    sponsor: preview.sponsor || "Sponsor name",
    title: preview.title || "Your headline goes here",
    description: preview.description || null,
    cta: preview.cta || null,
    link_url: preview.link ? "https://example.com" : null,
    image_url: preview.image || null,
    placements: PLACES.map((p) => p.id),
    active: true,
    starts_at: null,
    ends_at: null,
    created_at: "",
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <form
        ref={formRef}
        className="space-y-2 rounded-2xl border border-line bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const img = fd.get("image");
            if (img instanceof File && img.size > 0) fd.set("image", await shrinkImage(img));
            const res = await createBanner(fd);
            if (!res.ok) return toast(res.error, "error");
            toast("Banner is live 🎉");
            formRef.current?.reset();
            setPreview({ sponsor: "", title: "", description: "", cta: "", link: "", image: "" });
          });
        }}
      >
        <p className="font-semibold text-white">New sponsor banner</p>
        <input name="sponsor" maxLength={60} required placeholder="Sponsor name, e.g. Campus Bites" className={inputCls} onChange={(e) => set("sponsor", e.target.value)} />
        <input name="title" maxLength={80} required placeholder="Headline, e.g. 2 shawarmas for ₦5,000 this week" className={inputCls} onChange={(e) => set("title", e.target.value)} />
        <textarea
          name="description"
          maxLength={240}
          rows={2}
          placeholder="Short description (optional)"
          className={`${inputCls} resize-none`}
          onChange={(e) => set("description", e.target.value)}
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input name="link_url" placeholder="Link (website, Instagram, WhatsApp)" className={inputCls} onChange={(e) => set("link", e.target.value)} />
          <input name="cta" maxLength={24} placeholder="Button, e.g. Order now" className={`${inputCls} w-36`} onChange={(e) => set("cta", e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted hover:text-white">
          <ImagePlus className="size-4 shrink-0" />
          <span className="truncate">Upload banner image (wide works best, e.g. 1200×400; we shrink it for you)</span>
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              set("image", f ? URL.createObjectURL(f) : "");
            }}
          />
        </label>
        <input name="image_url" placeholder="…or paste an image link" className={inputCls} onChange={(e) => set("image", e.target.value)} />
        {/* Shown in the sponsor bar on every page. */}
        {PLACES.map((p) => (
          <input key={p.id} type="hidden" name="placements" value={p.id} />
        ))}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Start (optional)
            <input type="date" name="starts_at" className={`${inputCls} mt-1 [color-scheme:dark]`} />
          </label>
          <label className="text-xs text-muted">
            End (optional)
            <input type="date" name="ends_at" className={`${inputCls} mt-1 [color-scheme:dark]`} />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Publish banner
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
        <SponsorBanner banner={previewBanner} />
        {banners.length > 0 && (
          <>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Your banners</p>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {banners.map((b) => {
                const ended = !!b.ends_at && new Date(b.ends_at).getTime() < now;
                return (
                  <li key={b.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold ${b.active && !ended ? "text-white" : "text-muted line-through"}`}>
                        {b.sponsor}: {b.title}
                      </span>
                      <span className="text-xs text-muted">
                        {b.placements.join(", ")}
                        {b.ends_at ? ` · until ${new Date(b.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                        {ended ? " · ended" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setBannerActive(b.id, !b.active);
                          if (!res.ok) toast(res.error, "error");
                        })
                      }
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      {b.active ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        confirm("Delete this banner?") &&
                        startTransition(async () => {
                          const res = await deleteBanner(b.id);
                          if (!res.ok) toast(res.error, "error");
                        })
                      }
                      className="shrink-0 rounded-lg p-1.5 text-muted hover:text-no"
                      aria-label="Delete banner"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
