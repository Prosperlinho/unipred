import type { Outcome, Pools } from "./types";

/**
 * Constant Product Market Maker (CPMM) for binary YES/NO markets.
 *
 * The AMM holds a reserve of YES tokens (y) and NO tokens (n) and keeps
 * y * n = k constant across trades. One YES + one NO token always
 * redeems for exactly 1 CP, so the AMM can "mint" complete sets from CP.
 *
 *   P(YES) = n / (y + n)        P(NO) = y / (y + n)
 *
 * Buying YES with `a` CP:
 *   1. Mint `a` complete sets      -> y + a, n + a
 *   2. Restore the invariant       -> y' = k / (n + a)
 *   3. Trader receives             -> (y + a) - y' YES shares
 * Fewer YES tokens left in the pool means YES becomes pricier.
 *
 * Selling `s` YES shares for `a` CP is the exact reverse: the trader deposits
 * `s` YES tokens and the AMM burns `a` complete sets so that
 *   (y + s - a)(n - a) = k
 */

export const SHARE_PAYOUT = 1;
const MIN_RESERVE = 1e-6;

export function probYes(pools: Pools): number {
  const total = pools.poolYes + pools.poolNo;
  if (total <= 0) return 0.5;
  return pools.poolNo / total;
}

export function priceOf(pools: Pools, outcome: Outcome): number {
  const p = probYes(pools);
  return outcome === "YES" ? p : 1 - p;
}

/** Initial reserves that put the market at probability `p` for YES. */
export function poolsForProbability(liquidity: number, p: number): Pools {
  const prob = Math.min(0.97, Math.max(0.03, p));
  return {
    poolYes: 2 * liquidity * (1 - prob),
    poolNo: 2 * liquidity * prob,
  };
}

export interface BuyQuote {
  cost: number;
  shares: number;
  avgPrice: number;
  payout: number;
  profit: number;
  roi: number;
  priceBefore: number;
  priceAfter: number;
  probYesAfter: number;
  newPools: Pools;
}

export function quoteBuy(pools: Pools, outcome: Outcome, amount: number): BuyQuote | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const { poolYes: y, poolNo: n } = pools;
  const k = y * n;
  let newPools: Pools;
  let shares: number;

  if (outcome === "YES") {
    const newNo = n + amount;
    const newYes = k / newNo;
    shares = y + amount - newYes;
    newPools = { poolYes: newYes, poolNo: newNo };
  } else {
    const newYes = y + amount;
    const newNo = k / newYes;
    shares = n + amount - newNo;
    newPools = { poolYes: newYes, poolNo: newNo };
  }

  if (shares <= 0 || newPools.poolYes < MIN_RESERVE || newPools.poolNo < MIN_RESERVE) {
    return null;
  }

  const payout = shares * SHARE_PAYOUT;
  return {
    cost: amount,
    shares,
    avgPrice: amount / shares,
    payout,
    profit: payout - amount,
    roi: (payout - amount) / amount,
    priceBefore: priceOf(pools, outcome),
    priceAfter: priceOf(newPools, outcome),
    probYesAfter: probYes(newPools),
    newPools,
  };
}

export interface SellQuote {
  shares: number;
  proceeds: number;
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
  probYesAfter: number;
  newPools: Pools;
}

export function quoteSell(pools: Pools, outcome: Outcome, shares: number): SellQuote | null {
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const own = outcome === "YES" ? pools.poolYes : pools.poolNo;
  const other = outcome === "YES" ? pools.poolNo : pools.poolYes;

  // Solve a^2 - (own + s + other) a + s * other = 0 for the smaller root,
  // using the numerically stable form a = 2c / (b + sqrt(b^2 - 4c)).
  const b = own + shares + other;
  const c = shares * other;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const proceeds = (2 * c) / (b + Math.sqrt(disc));

  const newOwn = own + shares - proceeds;
  const newOther = other - proceeds;
  if (proceeds <= 0 || newOther < MIN_RESERVE || newOwn < MIN_RESERVE) return null;

  const newPools: Pools =
    outcome === "YES"
      ? { poolYes: newOwn, poolNo: newOther }
      : { poolYes: newOther, poolNo: newOwn };

  return {
    shares,
    proceeds,
    avgPrice: proceeds / shares,
    priceBefore: priceOf(pools, outcome),
    priceAfter: priceOf(newPools, outcome),
    probYesAfter: probYes(newPools),
    newPools,
  };
}
