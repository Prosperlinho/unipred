import type { Outcome, Pools } from "./types";

/**
 * Constant Product Market Maker (x * y = k) for binary markets.
 * Mirrors buy_shares / sell_shares in supabase/migrations/0001_init.sql
 * so the quotes shown in the UI match what the database executes.
 *
 * Pools are measured in shares. One YES + one NO share always redeem for
 * SHARE_VALUE_KOBO (N100), so N100 of stake mints one complete set.
 *   P(YES) = no / (yes + no)
 */

export const SHARE_VALUE_KOBO = 10_000;

export function probYes(pools: Pools): number {
  const total = pools.pool_yes + pools.pool_no;
  return total > 0 ? pools.pool_no / total : 0.5;
}

export function priceOf(pools: Pools, outcome: Outcome): number {
  const p = probYes(pools);
  return outcome === "YES" ? p : 1 - p;
}

export interface BuyQuote {
  amountKobo: number;
  feeKobo: number;
  shares: number;
  avgPriceKobo: number;
  payoutKobo: number;
  profitKobo: number;
  roi: number;
  probYesAfter: number;
}

export function quoteBuy(pools: Pools, outcome: Outcome, amountKobo: number, feeBps: number): BuyQuote | null {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return null;
  const feeKobo = Math.floor((amountKobo * feeBps) / 10_000);
  const sets = (amountKobo - feeKobo) / SHARE_VALUE_KOBO;
  const k = pools.pool_yes * pools.pool_no;
  let yes: number;
  let no: number;
  let shares: number;
  if (outcome === "YES") {
    no = pools.pool_no + sets;
    yes = k / no;
    shares = pools.pool_yes + sets - yes;
  } else {
    yes = pools.pool_yes + sets;
    no = k / yes;
    shares = pools.pool_no + sets - no;
  }
  if (!(shares > 0)) return null;
  const payoutKobo = Math.floor(shares * SHARE_VALUE_KOBO);
  return {
    amountKobo,
    feeKobo,
    shares,
    avgPriceKobo: amountKobo / shares,
    payoutKobo,
    profitKobo: payoutKobo - amountKobo,
    roi: (payoutKobo - amountKobo) / amountKobo,
    probYesAfter: no / (yes + no),
  };
}

export interface SellQuote {
  shares: number;
  grossKobo: number;
  feeKobo: number;
  netKobo: number;
  avgPriceKobo: number;
  probYesAfter: number;
}

export function quoteSell(pools: Pools, outcome: Outcome, shares: number, feeBps: number): SellQuote | null {
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const own = outcome === "YES" ? pools.pool_yes : pools.pool_no;
  const other = outcome === "YES" ? pools.pool_no : pools.pool_yes;
  const b = own + shares + other;
  const c = shares * other;
  const sets = (2 * c) / (b + Math.sqrt(b * b - 4 * c));
  const grossKobo = Math.floor(sets * SHARE_VALUE_KOBO);
  const feeKobo = Math.floor((grossKobo * feeBps) / 10_000);
  const netKobo = grossKobo - feeKobo;
  if (netKobo <= 0) return null;
  const newOwn = own + shares - sets;
  const newOther = other - sets;
  const yes = outcome === "YES" ? newOwn : newOther;
  const no = outcome === "YES" ? newOther : newOwn;
  return {
    shares,
    grossKobo,
    feeKobo,
    netKobo,
    avgPriceKobo: netKobo / shares,
    probYesAfter: no / (yes + no),
  };
}
