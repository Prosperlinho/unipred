import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatNaira, formatSignedNaira } from "@/lib/format";
import { buildCandles } from "@/lib/candles";
import { marketProbYes, payoutIfWins, settledResult } from "@/lib/pool";
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

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/card/[marketId]">) {
  const { marketId } = await ctx.params;
  if (!UUID_RE.test(marketId)) return new Response("Not found", { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return new Response("Log in to create your card", { status: 401 });

  const supabase = await createClient();
  const [{ data: market }, { data: posData }, { data: historyData }] = await Promise.all([
    supabase.from("markets").select("*").eq("id", marketId).maybeSingle<Market>(),
    supabase.from("positions").select("*").eq("market_id", marketId).eq("user_id", viewer.id),
    supabase.from("market_history").select("p, t").eq("market_id", marketId).order("t", { ascending: true }).limit(2000),
  ]);
  const positions = ((posData ?? []) as Position[]).filter((p) => Number(p.cost_kobo) > 0);
  if (!market || positions.length === 0 || (market.status !== "open" && market.status !== "resolved")) {
    return new Response("No bet to show for this market", { status: 404 });
  }
  const settings = await getSettings();
  const { data: school } = await supabase
    .from("schools")
    .select("short_name")
    .eq("id", market.school_id)
    .maybeSingle<{ short_name: string }>();

  const totalStake = positions.reduce((s, p) => s + Number(p.cost_kobo), 0);
  const main = positions.reduce((a, b) => (Number(b.cost_kobo) > Number(a.cost_kobo) ? b : a));

  // Candles from the real betting history: YES share of the pot after every bet.
  const yesShare = marketProbYes(market);
  const opened = new Date(market.approved_at ?? market.created_at).getTime();
  const lastT = market.resolved_at ? new Date(market.resolved_at).getTime() : Date.now();
  const candles = buildCandles([
    { t: opened, p: Number(market.initial_prob) || 0.5 },
    ...((historyData ?? []) as Array<{ p: number; t: string }>).map((h) => ({ t: new Date(h.t).getTime(), p: Number(h.p) })),
    { t: lastT, p: yesShare },
  ]);

  let card: ResultCardInput = {
    kind: "backing",
    headline: `I'm backing ${main.outcome}`,
    amount: `~${formatNaira(payoutIfWins(market, main, settings.pool_fee_bps))}`,
    detail: `What I'd get if ${main.outcome} wins and betting closed now`,
    question: market.question,
    school: school?.short_name ?? "",
    username: viewer.profile.username,
    side: main.outcome,
    stake: formatNaira(totalStake),
    status: "Still live",
    yesShare,
    candles,
  };

  if (market.status === "resolved") {
    const results = positions.map((p) => settledResult(market, p, settings.pool_fee_bps));
    const won = results.find((r) => r?.kind === "won");
    if (!won && results.every((r) => r?.kind === "refunded")) {
      return new Response("This bet was refunded, so there's no card for it", { status: 404 });
    }
    card = won
      ? {
          ...card,
          kind: "won",
          headline: "I won",
          amount: formatNaira(won.amountKobo),
          detail: `${formatSignedNaira(won.amountKobo - totalStake)} profit · called it right`,
          status: `Result: ${market.resolution}`,
        }
      : {
          ...card,
          kind: "lost",
          headline: "I took an L",
          amount: formatNaira(totalStake),
          detail: `Backed ${main.outcome}, it went ${market.resolution}. Next one is mine.`,
          status: `Result: ${market.resolution}`,
        };
  }

  return renderResultCard(card, await fontsPromise, { "Cache-Control": "private, no-store" });
}
