export const CATEGORIES = ["Campus Politics", "Academics", "Sports", "Events & Lifestyle"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Outcome = "YES" | "NO";
export type TradeMode = "buy" | "sell";
export type MarketStatus = "pending" | "open" | "resolved" | "rejected" | "cancelled";
export type WithdrawalStatus = "pending" | "processing" | "paid" | "rejected" | "failed";

export const SORT_MODES = ["Trending", "Closing Soon", "Newest"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export interface School {
  id: string;
  name: string;
  short_name: string;
  state: string;
  ownership: "Federal" | "State" | "Private";
}

export interface Pools {
  pool_yes: number;
  pool_no: number;
}

export interface Market extends Pools {
  id: string;
  school_id: string;
  question: string;
  category: Category;
  criteria: string;
  source: string;
  closes_at: string;
  status: MarketStatus;
  resolution: Outcome | null;
  initial_prob: number;
  liquidity_kobo: number;
  volume_kobo: number;
  traders: number;
  created_by: string | null;
  admin_note: string | null;
  created_at: string;
  approved_at: string | null;
  resolved_at: string | null;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  school_id: string;
  date_of_birth: string;
  is_admin: boolean;
  created_at: string;
}

export interface Position {
  user_id: string;
  market_id: string;
  outcome: Outcome;
  shares: number;
  cost_kobo: number;
}

export interface PricePoint {
  t: number;
  p: number;
}

export interface CommentView {
  id: number;
  body: string;
  side: Outcome | null;
  created_at: string;
  username: string;
  isMine: boolean;
}

export interface LedgerEntry {
  id: number;
  kind: string;
  amount_kobo: number;
  balance_after_kobo: number;
  description: string;
  market_id: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount_kobo: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: WithdrawalStatus;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface PayoutAccount {
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export interface PlatformSettings {
  trade_fee_bps: number;
  min_trade_kobo: number;
  min_deposit_kobo: number;
  min_withdrawal_kobo: number;
}

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** State shape for forms driven by useActionState. */
export interface FormState {
  error?: string;
  message?: string;
  /** Submitted values echoed back on error so the form can refill them. */
  values?: Record<string, string>;
}
