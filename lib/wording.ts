/**
 * UniPred says "trade", not "bet". Messages written by the database (errors, wallet history,
 * notifications) still use the old word, so we reword them on the way to the screen.
 */
const RULES: Array<[RegExp, string]> = [
  [/\bplace a bet\b/g, "make a trade"],
  [/\bPlace a bet\b/g, "Make a trade"],
  [/\bplacing a bet\b/g, "making a trade"],
  [/\bbettors\b/g, "traders"],
  [/\bBettors\b/g, "Traders"],
  [/\bbettor\b/g, "trader"],
  [/\bBettor\b/g, "Trader"],
  [/\bbetting\b/g, "trading"],
  [/\bBetting\b/g, "Trading"],
  [/\bbets\b/g, "trades"],
  [/\bBets\b/g, "Trades"],
  [/\bbet\b/g, "trade"],
  [/\bBet\b/g, "Trade"],
];

export function tradeWording(text: string): string;
export function tradeWording(text: string | null | undefined): string | null | undefined;
export function tradeWording(text: string | null | undefined) {
  if (!text) return text;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}
