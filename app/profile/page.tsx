import { Briefcase, ChevronRight, Gift, GraduationCap, LogOut, Settings, Shield, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Container } from "@/components/Container";
import { InviteProgress, type ReferralStats } from "@/components/InviteProgress";
import { ShareButton } from "@/components/ShareButton";
import { requireViewer } from "@/lib/auth";
import { getSchools, getSettings } from "@/lib/data";
import { formatNaira, initials } from "@/lib/format";
import { getOrigin } from "@/lib/origin";
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
  const [schools, trades, proposals, { data: statsData }, origin, settings, { data: bonusRows }] = await Promise.all([
    getSchools(),
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("user_id", viewer.id),
    supabase.from("markets").select("id", { count: "exact", head: true }).eq("created_by", viewer.id),
    supabase.rpc("my_referral_stats"),
    getOrigin(),
    getSettings(),
    supabase.from("ledger").select("amount_kobo").eq("user_id", viewer.id).eq("kind", "referral"),
  ]);
  const earnedKobo = ((bonusRows ?? []) as Array<{ amount_kobo: number }>).reduce((sum, r) => sum + Number(r.amount_kobo), 0);
  const stats = statsData as ReferralStats | null;
  const ratePct = (stats?.rate_bps ?? settings.referral_share_bps) / 100;
  const joined = stats?.joined ?? 0;
  const inviteLink = `${origin}/?ref=${encodeURIComponent(viewer.profile.username)}`;
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
        <Stat label="Bets" value={String(trades.count ?? 0)} />
        <Stat label="Markets" value={String(proposals.count ?? 0)} />
        <Stat label="Invited" value={String(joined)} />
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-brand/30 bg-linear-to-br from-brand-teal/15 to-card p-4">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-brand" />
          <h2 className="font-semibold text-white">Invite your coursemates</h2>
          {stats?.is_partner && (
            <span className="ml-auto rounded-full bg-brand-gold/15 px-2 py-0.5 text-[11px] font-bold text-brand-gold">Partner</span>
          )}
        </div>
        <p className="text-sm text-muted">
          Earn <span className="font-semibold text-white">{ratePct}% of UniPred&apos;s fee</span> on your friends&apos; bets,
          win or lose, once they&apos;re <span className="font-semibold text-white">active</span>: at least{" "}
          {stats?.min_daily_bets ?? 5} bets a day for {stats?.streak_days ?? 3} days in a row. It&apos;s paid into your
          wallet when each market resolves, and comes out of UniPred&apos;s fee, never your friends&apos; winnings.
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-bg p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted">Joined</p>
            <p className="text-lg font-bold tabular-nums text-white">{joined}</p>
          </div>
          <div className="rounded-xl bg-bg p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted">Active</p>
            <p className="text-lg font-bold tabular-nums text-white">{stats?.active ?? 0}</p>
          </div>
          <div className="rounded-xl bg-bg p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted">Earned</p>
            <p className="text-lg font-bold tabular-nums text-yes">{formatNaira(earnedKobo)}</p>
          </div>
        </div>
        {stats && <InviteProgress stats={stats} />}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">{inviteLink}</span>
          <ShareButton
            variant="button"
            label="Share"
            path="/"
            text={`Join me on UniPred: predict what happens at ${school?.short_name ?? "our school"} and get paid in naira when you're right.`}
            refUsername={p.username}
          />
        </div>
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
