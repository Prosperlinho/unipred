import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatNaira, formatSignedNaira } from "@/lib/format";
import { buildTradeCandles } from "@/lib/candles";
import { marketProbYes, summarizeBets } from "@/lib/pool";
import { renderResultCard, type ResultCardInput } from "@/lib/resultCard";
import { createClient } from "@/lib/supabase/server";
import type { Market, Position } from "@/lib/types";

/**
 * Personal "I won / I lost / I'm backing" card for the signed-in user's bet on a market.
 * Only the owner can generate it: positions are read through RLS with their own session.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Inter (SIL Open Font License, see assets/fonts/LICENSE-Inter-OFL.txt).
const fontDir = join(process.cwd(), "assets", "fonts");
const fontsPromise = Promise.all(
  ["inter-latin-800-normal.woff", "inter-latin-ext-800-normal.woff", "inter-latin-500-normal.woff", "inter-latin-ext-500-normal.woff"].map(
    (f) => readFile(join(fontDir, f)),
  ),
).then(([latin800, ext800, latin500, ext500]) => ({ latin800, ext800, latin500, ext500 }));

export async function GET(req: NextRequest, ctx: RouteContext<"/api/card/[marketId]">) {
  const { marketId } = await ctx.params;
  // ?side=YES or ?side=NO makes a card for just that side when the user bet on both.
  const sideParam = req.nextUrl.searchParams.get("side");
  const onlySide = sideParam === "YES" || sideParam === "NO" ? sideParam : null;
  if (!UUID_RE.test(marketId)) return new Response("Not found", { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return new Response("Log in to create your card", { status: 401 });

  const supabase = await createClient();
  const [{ data: market }, { data: posData }, { data: historyData }] = await Promise.all([
    supabase.from("markets").select("*").eq("id", marketId).maybeSingle<Market>(),
    supabase.from("positions").select("*").eq("market_id", marketId).eq("user_id", viewer.id),
    supabase.from("market_history").select("p, t").eq("market_id", marketId).order("t", { ascending: true }).limit(2000),
  ]);
  const positions = ((posData ?? []) as Position[]).filter(
    (p) => Number(p.cost_kobo) > 0 && (!onlySide || p.outcome === onlySide),
  );
  if (!market || positions.length === 0 || (market.status !== "open" && market.status !== "resolved")) {
    return new Response("No bet to show for this market", { status: 404 });
  }
  const settings = await getSettings();
  const { data: school } = await supabase
    .from("schools")
    .select("short_name")
    .eq("id", market.school_id)
    .maybeSingle<{ short_name: string }>();

  const summary = summarizeBets(market, positions, settings.pool_fee_bps);
  if (!summary) return new Response("No bet to show for this market", { status: 404 });
  if (summary.kind === "refunded") {
    return new Response(
      `This ${onlySide ? `${onlySide} bet` : "bet"} was refunded in full, so there's no win or loss card for it.`,
      { status: 404 },
    );
  }
  const hedged = summary.perSide.length > 1;
  const sideBreakdown = summary.perSide.map((p) => `${formatNaira(p.stakeKobo)} on ${p.outcome}`).join(" + ");

  // Candles from the real betting history: YES share of the pot after every bet.
  const yesShare = marketProbYes(market);
  const opened = new Date(market.approved_at ?? market.created_at).getTime();
  const lastT = market.resolved_at ? new Date(market.resolved_at).getTime() : Date.now();
  const candles = buildTradeCandles([
    { t: opened, p: Number(market.initial_prob) || 0.5 },
    ...((historyData ?? []) as Array<{ p: number; t: string }>).map((h) => ({ t: new Date(h.t).getTime(), p: Number(h.p) })),
    { t: lastT, p: yesShare },
  ]);

  const common = {
    question: market.question,
    school: school?.short_name ?? "",
    username: viewer.profile.username,
    side: summary.sidesLabel,
    stake: formatNaira(summary.totalStakeKobo),
    yesShare,
    candles,
  };

  let card: Omit<ResultCardInput, "pnl">;
  if (summary.kind === "open") {
    card = {
      ...common,
      kind: "backing",
      headline: `I'm backing ${summary.main}`,
      amount: `~${formatNaira(summary.returnedKobo)}`,
      detail: hedged ? `Hedged: ${sideBreakdown}` : `What I'd get if ${summary.main} wins and betting closed now`,
      status: "Still live",
    };
  } else if (summary.kind === "won") {
    card = {
      ...common,
      kind: "won",
      headline: summary.netKobo === 0 ? "I called it" : "I won",
      amount: formatNaira(summary.returnedKobo),
      detail:
        summary.netKobo === 0
          ? "Called it right · stake back (nobody took the other side)"
          : onlySide
            ? `${formatSignedNaira(summary.netKobo)} profit on my ${onlySide} bet`
            : `${formatSignedNaira(summary.netKobo)} profit · called it right`,
      status: `Result: ${market.resolution}`,
    };
  } else {
    card = {
      ...common,
      kind: "lost",
      headline: "I took an L",
      amount: formatNaira(-summary.netKobo),
      detail:
        summary.returnedKobo > 0
          ? `Got back ${formatNaira(summary.returnedKobo)} when ${market.resolution} won`
          : `Backed ${summary.main}, it went ${market.resolution}. Next one is mine.`,
      status: `Result: ${market.resolution}`,
    };
  }

  const pnl = summary.kind === "open" ? `~${formatSignedNaira(summary.netKobo)}` : formatSignedNaira(summary.netKobo);
  return renderResultCard({ ...card, pnl }, await fontsPromise, { "Cache-Control": "private, no-store" });
}
