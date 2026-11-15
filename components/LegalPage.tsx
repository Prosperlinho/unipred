import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "./Container";

export const LEGAL_LAST_UPDATED = "15 November 2026";

/** Support address shown in the legal pages. Set NEXT_PUBLIC_SUPPORT_EMAIL in Vercel. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "prosperlinho@gmail.com";

export function SupportContact() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>the support contact published on this page</span>
  );
}

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Container narrow>
      <nav className="mb-6 flex flex-wrap gap-2 text-xs">
        {[
          ["/rules", "House Rules"],
          ["/terms", "Terms & Conditions"],
          ["/privacy", "Privacy Policy"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-line px-3 py-1 text-muted hover:text-white">
            {label}
          </Link>
        ))}
      </nav>
      <h1 className="font-serif text-3xl text-white">{title}</h1>
      <p className="mt-1 text-xs text-muted">Last updated {LEGAL_LAST_UPDATED}</p>
      <div className="mt-4 text-sm leading-relaxed text-white/80">{intro}</div>
      <div className="legal mt-6 space-y-6 text-sm leading-relaxed text-white/80">{children}</div>
    </Container>
  );
}

export function Clause({ n, title, children }: { n: number | string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-white">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
