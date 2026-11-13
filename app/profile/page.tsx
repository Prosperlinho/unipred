import { Briefcase, ChevronRight, GraduationCap, LogOut, Settings, Shield, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Container } from "@/components/Container";
import { requireViewer } from "@/lib/auth";
import { getSchools } from "@/lib/data";
import { formatNaira, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile · UniPred" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3 text-center">
      <p className="text-lg font-bold tabular-nums text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  const supabase = await createClient();
  const [schools, trades, proposals, live] = await Promise.all([
    getSchools(),
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("user_id", viewer.id),
    supabase.from("markets").select("id", { count: "exact", head: true }).eq("created_by", viewer.id),
    supabase.from("markets").select("id", { count: "exact", head: true }).eq("created_by", viewer.id).eq("status", "open"),
  ]);
  const school = schools.find((s) => s.id === viewer.profile.school_id);
  const p = viewer.profile;

  const links = [
    { href: "/wallet", label: "Wallet", detail: formatNaira(viewer.balanceKobo), Icon: Wallet },
    { href: "/portfolio", label: "Portfolio", detail: "Positions & proposals", Icon: Briefcase },
    { href: "/settings", label: "Settings", detail: "Profile, payout bank, password", Icon: Settings },
    ...(p.is_admin ? [{ href: "/admin", label: "Admin", detail: "Review, resolve, pay out", Icon: Shield }] : []),
  ];

  return (
    <Container narrow>
      <section className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-extrabold text-black">
          {initials(p.username)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-white">@{p.username}</h1>
          {p.full_name && <p className="truncate text-sm text-white/80">{p.full_name}</p>}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-brand-gold">
            <GraduationCap className="size-3.5" /> {school?.name ?? p.school_id}
          </p>
          <p className="text-[11px] text-muted">
            {viewer.email} · Joined {new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Trades" value={String(trades.count ?? 0)} />
        <Stat label="Proposed" value={String(proposals.count ?? 0)} />
        <Stat label="Live" value={String(live.count ?? 0)} />
      </section>

      <nav className="mt-6 divide-y divide-line rounded-2xl border border-line bg-card">
        {links.map(({ href, label, detail, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 p-4 transition hover:bg-card-2">
            <Icon className="size-5 text-muted" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-white">{label}</span>
              <span className="text-xs text-muted">{detail}</span>
            </span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        ))}
      </nav>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-semibold text-muted transition hover:border-no/50 hover:text-no"
        >
          <LogOut className="size-4" /> Log out
        </button>
      </form>
    </Container>
  );
}
