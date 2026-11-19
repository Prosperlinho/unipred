import { ArrowUpRight } from "lucide-react";
import type { SponsorBanner as Banner } from "@/lib/types";

/** Sponsored banner card: image, sponsor, title, description and a call-to-action link. */
export function SponsorBanner({ banner, className = "" }: { banner: Banner | null; className?: string }) {
  if (!banner) return null;
  const body = (
    <>
      {banner.image_url && (
        // Banner images come from our storage bucket or a link the admin pastes, so a plain <img> avoids image host config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.image_url} alt={`${banner.sponsor}: ${banner.title}`} loading="lazy" className="aspect-[3/1] w-full object-cover" />
      )}
      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Sponsored · <span className="text-cream">{banner.sponsor}</span>
          </p>
          <p className="mt-0.5 font-extrabold leading-snug text-white">{banner.title}</p>
          {banner.description && <p className="mt-1 text-sm leading-relaxed text-white/75">{banner.description}</p>}
        </div>
        {banner.link_url && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-black">
            {banner.cta || "Learn more"} <ArrowUpRight className="size-3.5" />
          </span>
        )}
      </div>
    </>
  );
  const cls = `block overflow-hidden rounded-3xl border border-white/10 bg-card shadow-[0_18px_50px_-24px_rgb(0_0_0/0.8)] ${className}`;
  return banner.link_url ? (
    <a href={banner.link_url} target="_blank" rel="noopener noreferrer sponsored" className={`${cls} transition hover:border-brand/40`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}
