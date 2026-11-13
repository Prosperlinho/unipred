export const CATEGORIES = [
  "Campus Politics",
  "Academics",
  "Sports",
  "Events & Lifestyle",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Outcome = "YES" | "NO";

export type TradeMode = "buy" | "sell";

export const SORT_MODES = ["Trending", "Closing Soon", "Newest"] as const;

export type SortMode = (typeof SORT_MODES)[number];

export interface Comment {
  id: string;
  author: string;
  text: string;
  side: Outcome | null;
  createdAt: number;
  isUser: boolean;
}

export interface PricePoint {
  /** Unix ms timestamp */
  t: number;
  /** Probability of YES at this moment (0..1) */
  p: number;
}

export interface Pools {
  /** Outstanding YES tokens held by the AMM */
  poolYes: number;
  /** Outstanding NO tokens held by the AMM */
  poolNo: number;
}

export interface Market extends Pools {
  id: string;
  question: string;
  category: Category;
  criteria: string;
  source: string;
  createdAt: number;
  closesAt: number;
  creator: string;
  createdByUser: boolean;
  /** CP the creator seeded into the pool */
  liquidity: number;
  /** Anti-spam bond locked by the creator (refunded on resolution) */
  creatorBond: number;
  volume: number;
  traders: number;
  resolution: Outcome | null;
  resolvedAt: number | null;
  history: PricePoint[];
  comments: Comment[];
}

export interface Position {
  marketId: string;
  outcome: Outcome;
  shares: number;
  /** Total CP spent on the shares currently held */
  costBasis: number;
  claimed: boolean;
}

export interface AppState {
  version: number;
  balance: number;
  markets: Market[];
  positions: Position[];
}

export interface NewMarketInput {
  question: string;
  category: Category;
  criteria: string;
  source: string;
  closesAt: number;
  liquidity: number;
}

export type ActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };
