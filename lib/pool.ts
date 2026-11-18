import { SHARE_VALUE_KOBO, probYes as ammProbYes } from "./amm";
import type { Market, Outcome } from "./types";

/**
 * Pool (parimutuel) betting. Mirrors place_bet / resolve_market in
 * supabase/migrations/0005_pool_betting.sql so the UI shows exactly what gets paid.
 *
 *   winner's payout = stake + stake / (winning pot) * (losing pot) * (1 - fee)
 *
 * UniPred never adds money: if nobody bet on the losing side, winners get their
 * stake back; if nobody backed the winning side, everyone is refunded.
 * Markets that finished before the switch used the old fixed-odds engine ("amm").
 */

type PoolFields = Pick<Market, "engine" | "stake_yes_kobo" | "stake_no_kobo" | "pool_yes" | "pool_no">;

export function marketProbYes(m: PoolFields): number {
  if (m.engine === "amm") return ammProbYes({ pool_yes: Number(m.pool_yes), pool_no: Number(m.pool_no) });
  const yes = Number(m.stake_yes_kobo);
  const no = Number(m.stake_no_kobo);
  return yes + no > 0 ? yes / (yes + no) : 0.5;
}

export function pots(m: Pick<Market, "stake_yes_kobo" | "stake_no_kobo">, outcome: Outcome) {
  const yes = Number(m.stake_yes_kobo);
  const no = Number(m.stake_no_kobo);
  return outcome === "YES" ? { win: yes, lose: no } : { win: no, lose: yes };
}

/** Payout for `stake` on the winning side, given the final pots. */
export function poolPayout(stakeKobo: number, winPotKobo: number, losePotKobo: number, feeBps: number): number {
  if (winPotKobo <= 0) return stakeKobo;
  return stakeKobo + Math.floor((stakeKobo * losePotKobo * (10_000 - feeBps)) / (10_000 * winPotKobo));
}

export interface BetEstimate {
  payoutKobo: number;
  profitKobo: number;
  multiplier: number;
  probYesAfter: number;
}

/** What a new bet would pay if betting closed right after it. */
export function estimateBet(
  m: Pick<Market, "stake_yes_kobo" | "stake_no_kobo">,
  outcome: Outcome,
  amountKobo: number,
  feeBps: number,
): BetEstimate | null {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return null;
  const { win, lose } = pots(m, outcome);
  const payoutKobo = poolPayout(amountKobo, win + amountKobo, lose, feeBps);
  const yesAfter = Number(m.stake_yes_kobo) + (outcome === "YES" ? amountKobo : 0);
  const noAfter = Number(m.stake_no_kobo) + (outcome === "NO" ? amountKobo : 0);
  return {
    payoutKobo,
    profitKobo: payoutKobo - amountKobo,
    multiplier: payoutKobo / amountKobo,
    probYesAfter: yesAfter / (yesAfter + noAfter),
  };
}

/** What an existing bet pays if its side wins (current pots for open markets, final pots once resolved). */
export function payoutIfWins(
  m: PoolFields,
  pos: { outcome: Outcome; shares: number; cost_kobo: number },
  feeBps: number,
): number {
  if (m.engine === "amm") return Math.floor(Number(pos.shares) * SHARE_VALUE_KOBO);
  const { win, lose } = pots(m, pos.outcome);
  return poolPayout(Number(pos.cost_kobo), win, lose, feeBps);
}

export type Settled = { kind: "won"; amountKobo: number } | { kind: "lost"; amountKobo: number } | { kind: "refunded"; amountKobo: number };

/** Outcome of a bet on a resolved or cancelled market. */
export function settledResult(
  m: PoolFields & Pick<Market, "status" | "resolution">,
  pos: { outcome: Outcome; shares: number; cost_kobo: number },
  feeBps: number,
): Settled | null {
  const stake = Number(pos.cost_kobo);
  if (m.status === "cancelled") return { kind: "refunded", amountKobo: stake };
  if (m.status !== "resolved" || !m.resolution) return null;
  if (pos.outcome === m.resolution) return { kind: "won", amountKobo: payoutIfWins(m, pos, feeBps) };
  if (m.engine === "pool" && pots(m, m.resolution).win === 0) return { kind: "refunded", amountKobo: stake };
  return { kind: "lost", amountKobo: stake };
}

export interface BetSummary {
  /** "won" / "lost" are judged on the overall result across both sides. */
  kind: "won" | "lost" | "refunded" | "open";
  totalStakeKobo: number;
  /** Money returned (winnings + refunds). Estimated "if main side wins" while open. */
  returnedKobo: number;
  /** returned - staked. */
  netKobo: number;
  /** The side with the most money on it. */
  main: Outcome;
  /** "YES", "NO" or "YES + NO" when the user backed both sides. */
  sidesLabel: string;
  perSide: Array<{ outcome: Outcome; stakeKobo: number }>;
}

/** One verdict for everything a user staked on a market (handles bets on both sides). */
export function summarizeBets(
  m: PoolFields & Pick<Market, "status" | "resolution">,
  positions: Array<{ outcome: Outcome; shares: number; cost_kobo: number }>,
  feeBps: number,
): BetSummary | null {
  const live = positions.filter((p) => Number(p.cost_kobo) > 0);
  if (live.length === 0) return null;
  const perSide = live.map((p) => ({ outcome: p.outcome, stakeKobo: Number(p.cost_kobo) }));
  const totalStakeKobo = perSide.reduce((s, p) => s + p.stakeKobo, 0);
  const mainPos = live.reduce((a, b) => (Number(b.cost_kobo) > Number(a.cost_kobo) ? b : a));
  const sides = [...new Set(live.map((p) => p.outcome))].sort((a, b) => (a === "YES" ? -1 : b === "YES" ? 1 : 0));
  const base = { totalStakeKobo, main: mainPos.outcome, sidesLabel: sides.join(" + "), perSide };

  if (m.status === "open" || (m.status !== "resolved" && m.status !== "cancelled")) {
    const returnedKobo = payoutIfWins(m, mainPos, feeBps);
    return { ...base, kind: "open", returnedKobo, netKobo: returnedKobo - totalStakeKobo };
  }

  const results = live.map((p) => settledResult(m, p, feeBps));
  const returnedKobo = results.reduce((s, r) => s + (r && r.kind !== "lost" ? r.amountKobo : 0), 0);
  const netKobo = returnedKobo - totalStakeKobo;
  const allRefunded = results.every((r) => r?.kind === "refunded");
  // A correct call is a win even with no profit (e.g. nobody took the other side, so the stake just came back).
  const calledIt = results.some((r) => r?.kind === "won");
  const kind = allRefunded ? "refunded" : netKobo > 0 || (netKobo === 0 && calledIt) ? "won" : "lost";
  return { ...base, kind, returnedKobo, netKobo };
}
