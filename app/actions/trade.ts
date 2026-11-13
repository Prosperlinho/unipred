"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Outcome } from "@/lib/types";

interface TradeResult {
  shares: number;
  amount_kobo: number;
  fee_kobo: number;
  prob_yes: number;
  balance_kobo: number;
}

function isOutcome(v: unknown): v is Outcome {
  return v === "YES" || v === "NO";
}

function refresh(marketId: string) {
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/wallet");
}

/** Buy shares with `amountKobo`. Fails if fewer than `minShares` would be received (price moved). */
export async function buyShares(
  marketId: string,
  outcome: Outcome,
  amountKobo: number,
  minShares: number,
): Promise<ActionResult<TradeResult>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in to trade." };
  if (!isOutcome(outcome) || !Number.isInteger(amountKobo) || amountKobo <= 0) {
    return { ok: false, error: "Invalid trade." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buy_shares", {
    p_market: marketId,
    p_outcome: outcome,
    p_amount_kobo: amountKobo,
    p_min_shares: Math.max(0, minShares),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refresh(marketId);
  return { ok: true, value: data as TradeResult };
}

/** Sell `shares`. Fails if the payout would drop below `minKobo` (price moved). */
export async function sellShares(
  marketId: string,
  outcome: Outcome,
  shares: number,
  minKobo: number,
): Promise<ActionResult<TradeResult>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in to trade." };
  if (!isOutcome(outcome) || !Number.isFinite(shares) || shares <= 0) {
    return { ok: false, error: "Invalid trade." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_shares", {
    p_market: marketId,
    p_outcome: outcome,
    p_shares: shares,
    p_min_kobo: Math.max(0, Math.floor(minKobo)),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refresh(marketId);
  return { ok: true, value: data as TradeResult };
}
