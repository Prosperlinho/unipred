import { ArrowLeft, Ban, CheckCircle2, Clock, Hourglass, Info, Lock, TrendingUp, Users, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Comments } from "@/components/Comments";
import { Container } from "@/components/Container";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { ResultCardShare } from "@/components/ResultCardShare";
import { ShareButton } from "@/components/ShareButton";
import { Sparkline } from "@/components/Sparkline";
import { TradeBox } from "@/components/TradeBox";
import { getRequestTime } from "@/lib/time";
import { getViewer } from "@/lib/auth";
import { marketProbYes, payoutIfWins, settledResult, summarizeBets, type Settled } from "@/lib/pool";
import { getSchools, getSettings } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { compactNaira, formatDate, formatNaira, formatPct, timeLeft } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CommentView, Market, Outcome, Position, PricePoint } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadMarket(id: string): Promise<Market | null> {
  if (!isSupabaseConfigured || !UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select("*").eq("id", id).maybeSingle<Market>();
  return data;
}

export async function generateMetadata(props: PageProps<"/markets/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const market = await loadMarket(id);
  if (!market) return { title: "Market · UniPred" };
  const pct = formatPct(marketProbYes(market));
  const description = `${pct} of the pot is on YES. Make your call and get paid in naira if you're right.`;
  return {
    title: `${market.question} · UniPred`,
    description,
    openGraph: { title: market.question, description, siteName: "UniPred", type: "website" },
    twitter: { card: "summary_large_image", title: market.question, description },
  };
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

export default async function MarketPage(props: PageProps<"/markets/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const market = await loadMarket(id);
  if (!market) notFound();

  const supabase = await createClient();
  const [viewer, settings, schools, historyRes, commentsRes] = await Promise.all([
    getViewer(),
    getSettings(),
    getSchools(),
    supabase.from("market_history").select("p, t").eq("market_id", id).order("t", { ascending: true }).limit(500),
    supabase
      .from("comments")
      .select("id, body, side, created_at, user_id")
      .eq("market_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rawComments = (commentsRes.data ?? []) as Array<{
    id: number;
    body: string;
    side: Outcome | null;
    created_at: string;
    user_id: string;
  }>;
  const authorIds = [...new Set(rawComments.map((c) => c.user_id))];
  const [{ data: authors }, { data: myPositions }] = await Promise.all([
    authorIds.length
      ? supabase.from("public_profiles").select("id, username").in("id", authorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string }> }),
    viewer
      ? supabase.from("positions").select("*").eq("market_id", id).eq("user_id", viewer.id)
      : Promise.resolve({ data: [] as Position[] }),
  ]);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.username]));
  const comments: CommentView[] = rawComments.map((c) => ({
    id: c.id,
    body: c.body,
    side: c.side,
    created_at: c.created_at,
    username: nameById.get(c.user_id) ?? "student",
    isMine: c.user_id === viewer?.id,
  }));

  const holdings: Partial<Record<Outcome, { shares: number; cost_kobo: number }>> = {};
  for (const pos of (myPositions ?? []) as Position[]) {
    if (Number(pos.cost_kobo) > 0) holdings[pos.outcome] = { shares: Number(pos.shares), cost_kobo: Number(pos.cost_kobo) };
  }

  const now = getRequestTime();
  const p = marketProbYes(market);
  const displayP = market.status === "resolved" ? (market.resolution === "YES" ? 1 : 0) : p;
  const start = new Date(market.approved_at ?? market.created_at).getTime();
  const history: PricePoint[] = [
    { t: start, p: Number(market.initial_prob) },
    ...((historyRes.data ?? []) as Array<{ p: number; t: string }>).map((h) => ({ t: new Date(h.t).getTime(), p: Number(h.p) })),
    { t: market.resolved_at ? new Date(market.resolved_at).getTime() : now, p: displayP },
  ];
  const change = p - Number(market.initial_prob);
  const closesAt = new Date(market.closes_at).getTime();
  const closed = now >= closesAt;
  const school = schools.find((s) => s.id === market.school_id);
  const requestedSide = searchParams.side === "NO" ? "NO" : "YES";
  // Pre-filled bet links: /markets/<id>?side=YES&amount=1000
  const rawAmount = Number(typeof searchParams.amount === "string" ? searchParams.amount : NaN);
  const requestedAmount = Number.isFinite(rawAmount) && rawAmount >= 1 && rawAmount <= 500_000 ? Math.floor(rawAmount) : null;
  const defaultCommentSide: Outcome | null =
    holdings.YES && !holdings.NO ? "YES" : holdings.NO && !holdings.YES ? "NO" : null;

  let sidePanel: ReactNode;
  if (market.status === "pending") {
    sidePanel = (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-amber-300">
          <Hourglass className="size-4" /> Waiting for review
        </p>
        <p className="mt-1 text-muted">Only you can see this. It goes live once a UniPred admin approves it.</p>
      </div>
    );
  } else if (market.status === "rejected") {
    sidePanel = (
      <div className="rounded-2xl border border-no/30 bg-no/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-no">
          <XCircle className="size-4" /> Not approved
        </p>
        {market.admin_note && <p className="mt-1 text-muted">Reason: {market.admin_note}</p>}
      </div>
    );
  } else if (market.status === "resolved") {
    sidePanel = (
      <div className={`rounded-2xl p-4 ${market.resolution === "YES" ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}>
        <p className="flex items-center gap-2 text-lg font-bold">
          <CheckCircle2 className="size-5" /> Resolved {market.resolution}
        </p>
        <p className="mt-1 text-sm opacity-80">
          Everyone who backed {market.resolution} was paid straight into their wallet
          {market.resolved_at ? ` on ${formatDate(market.resolved_at)}` : ""}.
        </p>
      </div>
    );
  } else if (market.status === "cancelled") {
    sidePanel = (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-white">
          <Ban className="size-4" /> Market cancelled
        </p>
        <p className="mt-1 text-muted">Everyone&apos;s stake was refunded to their wallet.{market.admin_note ? ` Reason: ${market.admin_note}` : ""}</p>
      </div>
    );
  } else if (closed) {
    sidePanel = (
      <div className="rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-white">
          <Lock className="size-4" /> Trading closed
        </p>
        <p className="mt-1 text-muted">Waiting for an admin to confirm the result. Winners are paid automatically.</p>
      </div>
    );
  } else {
    sidePanel = (
      <TradeBox
        marketId={market.id}
        stakeYesKobo={Number(market.stake_yes_kobo)}
        stakeNoKobo={Number(market.stake_no_kobo)}
        closesAt={market.closes_at}
        feeBps={settings.pool_fee_bps}
        minTradeKobo={settings.min_trade_kobo}
        balanceKobo={viewer ? viewer.balanceKobo : null}
        initialSide={requestedSide}
        initialAmountNaira={requestedAmount}
        question={market.question}
        refUsername={viewer?.profile.username ?? null}
        serverNow={now}
        myStakes={{ YES: holdings.YES?.cost_kobo ?? 0, NO: holdings.NO?.cost_kobo ?? 0 }}
        exitFeeBps={settings.exit_fee_bps}
      />
    );
  }

  const positionRows = (["YES", "NO"] as const).flatMap((o) => {
    const h = holdings[o];
    if (!h) return [];
    const pos = { outcome: o, shares: h.shares, cost_kobo: h.cost_kobo };
    return [
      {
        outcome: o,
        staked: h.cost_kobo,
        pays: payoutIfWins(market, pos, settings.pool_fee_bps),
        settled: settledResult(market, pos, settings.pool_fee_bps) as Settled | null,
      },
    ];
  });

  // One overall verdict across both sides, used for the share card and the "Overall" line.
  const summary = summarizeBets(
    market,
    positionRows.map((r) => ({ outcome: r.outcome, shares: holdings[r.outcome]?.shares ?? 0, cost_kobo: r.staked })),
    settings.pool_fee_bps,
  );
  const hedged = positionRows.length > 1;
  type Card = { kind: "won" | "lost" | "backing"; caption: string; side?: "YES" | "NO" };
  const cardFrom = (sum: typeof summary, side?: "YES" | "NO"): Card | null => {
    if (sum?.kind === "open") {
      return {
        kind: "backing",
        side,
        caption: `I'm backing ${sum.main} on "${market.question}" Think I'm wrong? Bet against me on UniPred:`,
      };
    }
    if (sum?.kind === "won") {
      return {
        kind: "won",
        side,
        caption: `I just won ${formatNaira(sum.returnedKobo)} on UniPred calling ${side ? `${side} on ` : ""}"${market.question}" right 🎯`,
      };
    }
    if (sum?.kind === "lost") {
      return {
        kind: "lost",
        side,
        caption: `Took an L of ${formatNaira(-sum.netKobo)} on ${side ? `my ${side} bet on ` : ""}"${market.question}" Next one is mine. Join me on UniPred:`,
      };
    }
    return null;
  };
  // Bets on both sides get a separate card for each side; a single bet gets one card.
  const cards: Card[] = hedged
    ? positionRows.flatMap((r) => {
        const c = cardFrom(
          summarizeBets(market, [{ outcome: r.outcome, shares: holdings[r.outcome]?.shares ?? 0, cost_kobo: r.staked }], settings.pool_fee_bps),
          r.outcome,
        );
        return c ? [c] : [];
      })
    : [cardFrom(summary)].filter((c): c is Card => c !== null);

  return (
    <Container>
      <Link
        href={school ? `/?school=${school.id}#markets` : "/"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-white"
      >
        <ArrowLeft className="size-4" /> {school ? `${school.short_name} markets` : "All markets"}
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={market.category} />
              {school && (
                <span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-[11px] font-semibold text-brand-gold">
                  {school.name}
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold leading-snug text-white sm:text-2xl">{market.question}</h1>
              {market.status !== "pending" && market.status !== "rejected" && (
                <ShareButton
                  variant="icon"
                  label="Share market"
                  path={`/markets/${market.id}`}
                  text={`${market.question} YES is at ${formatPct(displayP)} on UniPred. What's your call?`}
                  refUsername={viewer?.profile.username ?? null}
                />
              )}
            </div>
            {searchParams.new === "1" && market.status === "open" && (
              <div className="rounded-xl bg-yes/10 px-3 py-2 text-sm text-yes">
                Your market is live! Share it so your coursemates can bet on it.
              </div>
            )}
          </div>

          <div>
            <p className="text-3xl font-extrabold tabular-nums text-white">
              {formatPct(displayP)}
              <span className="ml-1.5 text-sm font-medium text-muted">chance YES</span>
            </p>
            {market.status === "open" && Math.abs(change) >= 0.005 && (
              <p className={`text-xs font-semibold tabular-nums ${change >= 0 ? "text-yes" : "text-no"}`}>
                {change >= 0 ? "▲" : "▼"} {formatPct(Math.abs(change))} since opening
              </p>
            )}
          </div>

          {market.status !== "pending" && market.status !== "rejected" && (
            <>
              <Sparkline points={history} height={110} />
              <ProbabilityBar probYes={displayP} size="lg" />
            </>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={closed || market.status !== "open" ? Lock : Clock}
              label="Closes"
              value={market.status === "open" ? timeLeft(closesAt, now) : formatDate(market.closes_at)}
            />
            <Stat icon={TrendingUp} label="Volume" value={compactNaira(market.volume_kobo)} />
            <Stat icon={Users} label="Traders" value={String(market.traders)} />
          </div>

        </div>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20">{sidePanel}</div>
        </aside>

        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-2">
          {positionRows.length > 0 && (
            <div id="your-bets" className="scroll-mt-20 space-y-1.5 rounded-xl border border-line p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your bets</p>
              {positionRows.map((r) => (
                <div key={r.outcome} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span>
                    <span className="tabular-nums text-white">{formatNaira(r.staked)}</span> on{" "}
                    <span className={r.outcome === "YES" ? "font-bold text-yes" : "font-bold text-no"}>{r.outcome}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {market.status === "open" && (
                      <>
                        Pays about <span className="font-semibold text-white">{formatNaira(r.pays)}</span> if {r.outcome} wins
                      </>
                    )}
                    {r.settled?.kind === "won" && <span className="font-semibold text-yes">Won {formatNaira(r.settled.amountKobo)}</span>}
                    {r.settled?.kind === "lost" && <span className="font-semibold text-no">Lost</span>}
                    {r.settled?.kind === "refunded" && <span>Refunded</span>}
                  </span>
                </div>
              ))}
              {hedged && summary && summary.kind !== "open" && (
                <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
                  <span className="text-muted">Overall</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      summary.kind === "won" ? "text-yes" : summary.kind === "lost" ? "text-no" : "text-muted"
                    }`}
                  >
                    {summary.kind === "refunded"
                      ? "Refunded"
                      : `${summary.kind === "won" ? "Up" : "Down"} ${formatNaira(Math.abs(summary.netKobo))} (got back ${formatNaira(summary.returnedKobo)})`}
                  </span>
                </div>
              )}
              {viewer &&
                cards.map((card) => (
                  <div
                    key={card.side ?? "all"}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5"
                  >
                    <span className="text-xs text-muted">
                      {card.side && (
                        <span className={`mr-1 font-bold ${card.side === "YES" ? "text-yes" : "text-no"}`}>{card.side} bet:</span>
                      )}
                      {card.kind === "won" ? "Flex it." : card.kind === "lost" ? "Own it." : "Hype your call."} Download or share
                      your card.
                    </span>
                    <ResultCardShare
                      marketId={market.id}
                      kind={card.kind}
                      caption={card.caption}
                      refUsername={viewer.profile.username}
                      side={card.side}
                    />
                  </div>
                ))}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted">
              <Info className="size-4" /> Rules
            </h2>
            <div className="rounded-xl bg-card p-3 text-sm leading-relaxed text-white/90">{market.criteria}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-card p-3 text-xs">
              <dt className="text-muted">Source</dt>
              <dd className="text-white">{market.source}</dd>
              <dt className="text-muted">Closes</dt>
              <dd className="text-white">{formatDate(market.closes_at)}</dd>
              <dt className="text-muted">Resolved by</dt>
              <dd className="text-white">UniPred admins, using the source above</dd>
            </dl>
            <Link
              href="/rules"
              className="flex items-center justify-between rounded-xl border border-line p-3 text-xs text-muted transition hover:border-white/20 hover:text-white"
            >
              <span>Pool betting, payouts, refunds and account rules apply to every market.</span>
              <span className="shrink-0 font-semibold text-brand">House Rules →</span>
            </Link>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Campus Banter ({comments.length})</h2>
            <Comments
              marketId={market.id}
              comments={comments}
              loggedIn={!!viewer}
              defaultSide={defaultCommentSide}
              serverNow={now}
            />
          </section>
        </div>
      </div>
    </Container>
  );
}
