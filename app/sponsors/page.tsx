import { ArrowUpRight, Heart } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { SUPPORT_EMAIL } from "@/components/LegalPage";
import { createClient } from "@/lib/supabase/server";
import type { SponsorBanner } from "@/lib/types";

export const metadata: Metadata = {
  title: "Our sponsors · UniPred",
  description: "The brands backing UniPred and campus predictions.",
};

/** Every current sponsor in one tidy grid, however many there are. */
export default async function SponsorsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("sponsor_banners").select("*").order("created_at", { ascending: false }).limit(200);
  const banners = (Array.isArray(data) ? data : []) as SponsorBanner[];
  // One card per sponsor (their newest live banner).
  const bySponsor = new Map<string, SponsorBanner>();
  for (const b of banners) if (!bySponsor.has(b.sponsor.toLowerCase())) bySponsor.set(b.sponsor.toLowerCase(), b);
  const sponsors = [...bySponsor.values()];

  return (
    <Container>
      <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        <Heart className="size-6 text-brand" /> Our sponsors
      </h1>
      <p className="mb-5 text-sm text-muted">The brands backing UniPred. Show them some love.</p>

      {sponsors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm text-muted">Our first sponsors are coming soon.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((b) => {
            const card = (
              <>
                {b.image_url ? (
                  // Sponsor images come from our storage bucket or a link the admin pastes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_url} alt={`${b.sponsor}: ${b.title}`} loading="lazy" className="aspect-[3/1] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[3/1] items-center justify-center bg-linear-to-br from-brand/20 to-card-2 text-2xl font-black text-white">
                    {b.sponsor}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-cream">{b.sponsor}</p>
                  <p className="mt-0.5 font-extrabold leading-snug text-white">{b.title}</p>
                  {b.description && <p className="mt-1 line-clamp-3 text-sm text-white/75">{b.description}</p>}
                  {b.link_url && (
                    <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-black">
                      {b.cta || "Learn more"} <ArrowUpRight className="size-3.5" />
                    </span>
                  )}
                </div>
              </>
            );
            return (
              <li key={b.id}>
                {b.link_url ? (
                  <a
                    href={b.link_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card transition hover:border-brand/40"
                  >
                    {card}
                  </a>
                ) : (
                  <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card">{card}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="font-semibold text-white">Want to reach students?</p>
        <p className="mt-1 text-muted">
          Get your brand on UniPred&apos;s home page, markets and leaderboard. Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Sponsoring%20UniPred`} className="text-brand underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </Container>
  );
}
