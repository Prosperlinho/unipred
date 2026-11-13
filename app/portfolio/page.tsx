import { Briefcase, CheckCircle2, Clock, Hourglass, Lock, PlusCircle, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Container } from "@/components/Container";
import { FormMessage } from "@/components/forms";
import { getRequestTime } from "@/lib/time";
import { requireViewer } from "@/lib/auth";
import { SHARE_VALUE_KOBO, priceOf } from "@/lib/amm";
import { getSchools } from "@/lib/data";
import { formatNaira, formatPct, formatShares, formatSignedNaira, formatSignedPct, timeLeft } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Market, Position } from "@/lib/types";

export const metadata: Metadata = { title: "Portfolio · UniPred" };

type Row = Position & { market: Market };

function Summary({ label, value, tone }: { label: string; value: string; tone?: "yes" | "no" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "yes" ? "text-yes" : tone === "no" ? "text-no" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function Title({ children, count }: { children: string; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
      {children}
      <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{count}</span>
    </h2>
  );
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300",
  open: "bg-yes/10 text-yes",
  rejected: "bg-no/10 text-no",
  resolved: "bg-brand/10 text-brand",
  cancelled: "bg-card-2 text-muted",
};

export default async function PortfolioPage(props: PageProps<"/portfolio">) {
  const viewer = await requireViewer("/portfolio");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: posData }, { data: proposalData }, schools] = await Promise.all([
    supabase.from("positions").select("*, market:markets(*)").eq("user_id", viewer.id),
    supabase.from("markets").select("*").eq("created_by", viewer.id).order("created_at", { ascending: false }),
    getSchools(),
  ]);
  const schoolLabel = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const rows = ((posData ?? []) as Row[]).filter((r) => r.market && r.shares > 0);
  const proposals = (proposalData ?? []) as Market[];
  const now = getRequestTime();

  const valued = rows.map((r) => {
    const m = r.market;
    const price =
      m.status === "resolved" ? (m.resolution === r.outcome ? 1 : 0) : priceOf({ pool_yes: Number(m.pool_yes), pool_no: Number(m.pool_no) }, r.outcome);
    const value = Math.floor(r.shares * price * SHARE_VALUE_KOBO);
    return { ...r, price, value, pnl: value - r.cost_kobo };
  });
  const active = valued.filter((r) => r.market.status === "open");
  const settled = valued.filter((r) => r.market.status === "resolved" || r.market.status === "cancelled");

  const positionsValue = active.reduce((s, r) => s + r.value, 0);
  const unrealized = active.reduce((s, r) => s + r.pnl, 0);

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Your Portfolio</h1>
      <p className="mb-4 text-sm text-muted">Open positions, settled results and your market proposals.</p>
      {sp.proposed === "1" && (
        <div className="mb-4">
          <FormMessage message="Proposal submitted! You'll see it go live here once an admin approves it." />
        </div>
      )}

      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="Wallet" value={formatNaira(viewer.balanceKobo)} />
          <Summary label="In positions" value={formatNaira(positionsValue)} />
          <Summary
            label="Unrealized P&L"
            value={formatSignedNaira(unrealized)}
            tone={unrealized > 0 ? "yes" : unrealized < 0 ? "no" : undefined}
          />
          <Summary label="Total" value={formatNaira(viewer.balanceKobo + positionsValue)} />
        </section>

        <section className="space-y-3">
          <Title count={active.length}>Open positions</Title>
          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
              <Briefcase className="size-8 text-muted" />
              <p className="font-medium text-white">No open positions</p>
              <p className="text-sm text-muted">Pick a side on a market at your school to get started.</p>
              <Link href="/" className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black hover:brightness-110">
                Browse markets
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((r) => {
                const closesAt = new Date(r.market.closes_at).getTime();
                const closed = now >= closesAt;
                return (
                  <Link
                    key={`${r.market_id}-${r.outcome}`}
                    href={`/markets/${r.market_id}?side=${r.outcome}`}
                    className="block rounded-2xl border border-line bg-card p-4 transition hover:border-white/15"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <CategoryBadge category={r.market.category} />
                        <span className="text-[11px] font-semibold text-brand-gold">{schoolLabel[r.market.school_id]}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        {closed ? <Lock className="size-3.5" /> : <Clock className="size-3.5" />}
                        {closed ? "Awaiting result" : timeLeft(closesAt, now)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-white">{r.market.question}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">Side</span>
                        <span className={`font-bold ${r.outcome === "YES" ? "text-yes" : "text-no"}`}>{r.outcome}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Shares</span>
                        <span className="tabular-nums text-white">{formatShares(r.shares)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Avg entry</span>
                        <span className="tabular-nums text-white">{formatNaira(r.cost_kobo / r.shares)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Now</span>
                        <span className="tabular-nums text-white">
                          {formatNaira(r.price * SHARE_VALUE_KOBO)} <span className="text-muted">({formatPct(r.price)})</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Value</span>
                        <span className="tabular-nums text-white">{formatNaira(r.value)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">P&amp;L</span>
                        <span className={`font-semibold tabular-nums ${r.pnl >= 0 ? "text-yes" : "text-no"}`}>
                          {formatSignedNaira(r.pnl)}
                          {r.cost_kobo > 0 && ` (${formatSignedPct(r.pnl / r.cost_kobo)})`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {settled.length > 0 && (
          <section className="space-y-3">
            <Title count={settled.length}>Settled</Title>
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {settled.map((r) => {
                const won = r.market.status === "resolved" && r.market.resolution === r.outcome;
                const cancelled = r.market.status === "cancelled";
                return (
                  <Link
                    key={`${r.market_id}-${r.outcome}`}
                    href={`/markets/${r.market_id}`}
                    className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-card-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-white">{r.market.question}</span>
                      <span className="text-xs text-muted">
                        {formatShares(r.shares)} {r.outcome} ·{" "}
                        {cancelled ? "cancelled, stake refunded" : `resolved ${r.market.resolution}`}
                      </span>
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums ${
                        cancelled ? "text-muted" : won ? "text-yes" : "text-no"
                      }`}
                    >
                      {cancelled ? null : won ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                      {cancelled ? "Refunded" : won ? `Won ${formatNaira(r.value)}` : `Lost ${formatNaira(r.cost_kobo)}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <Title count={proposals.length}>Your proposals</Title>
          {proposals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
              <PlusCircle className="size-8 text-muted" />
              <p className="font-medium text-white">No proposals yet</p>
              <p className="max-w-xs text-sm text-muted">Spot something everyone&apos;s debating? Propose it as a market.</p>
              <Link href="/propose" className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black hover:brightness-110">
                Propose a market
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {proposals.map((m) => (
                <Link key={m.id} href={`/markets/${m.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-card-2">
                  <span className="min-w-0">
                    <span className="block truncate text-white">{m.question}</span>
                    <span className="text-xs text-muted">
                      {schoolLabel[m.school_id]}
                      {m.status === "rejected" && m.admin_note ? ` · ${m.admin_note}` : ""}
                    </span>
                  </span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_CHIP[m.status]}`}>
                    {m.status === "pending" && <Hourglass className="size-3" />}
                    {m.status === "pending" ? "In review" : m.status === "open" ? "Live" : m.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
