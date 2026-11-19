export const CATEGORIES = [
  "Campus Politics",
  "Academics",
  "Sports",
  "Events & Lifestyle",
  "Entertainment & Music",
  "Football",
  "Hostel Life",
  "Tech & Crypto",
  "Fashion & Style",
  "Politics & News",
  "Exams & Results",
] as const;
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
  /** Whether UniPred is open at this school. Inactive schools are hidden but keep their members and history. */
  active?: boolean;
}

export interface Pools {
  pool_yes: number;
  pool_no: number;
}

export interface Market extends Pools {
  id: string;
  /** "pool" = pool betting (current); "amm" = old fixed-odds markets that finished before the switch. */
  engine: "pool" | "amm";
  stake_yes_kobo: number;
  stake_no_kobo: number;
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
  /** Set when this is the pinned "Market of the day". */
  featured_at?: string | null;
  /** Set when this question belongs to a community room. */
  room_id?: string | null;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  school_id: string;
  date_of_birth: string;
  is_admin: boolean;
  created_at: string;
  terms_accepted_at: string | null;
  terms_version: number;
  onboarded_at: string | null;
  /** Leave me off the public leaderboard. */
  leaderboard_hidden?: boolean;
  /** Admin has allowed this member to propose markets. */
  can_propose?: boolean;
  /** Market categories the member chose to see (null = not chosen yet). */
  interests?: string[] | null;
  /** Send result / money-received emails. */
  notify_email?: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  payout_name_strikes: number;
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
  /** UniPred's cut of the winnings (losing pot), in basis points: 1000 = 10%. */
  pool_fee_bps: number;
  min_trade_kobo: number;
  min_deposit_kobo: number;
  min_withdrawal_kobo: number;
  /** Share of UniPred's fee paid to the inviter of each bettor (2000 = 20%). */
  referral_share_bps: number;
  /** Bump to make everyone accept updated house rules again. */
  terms_version: number;
  /** Fee for cashing a bet out early (1500 = 15% of the amount taken out). */
  exit_fee_bps: number;
  /** Welcome bonus credited to new sign-ups (test mode). */
  signup_bonus_kobo: number;
}

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** State shape for forms driven by useActionState. */
export interface FormState {
  error?: string;
  message?: string;
  /** Submitted values echoed back on error so the form can refill them. */
  values?: Record<string, string>;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  invite_code: string;
  suspended: boolean;
  created_at: string;
}

export type BannerPlacement = "home" | "markets" | "leaderboard";

export interface SponsorBanner {
  id: string;
  sponsor: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  cta: string | null;
  placements: BannerPlacement[];
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}
