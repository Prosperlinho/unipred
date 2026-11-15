"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Outcome } from "@/lib/types";

interface BetResult {
  amount_kobo: number;
  balance_kobo: number;
  stake_yes_kobo: number;
  stake_no_kobo: number;
}

/** Puts `amountKobo` from the wallet into the market's YES or NO pot. */
export async function placeBet(marketId: string, outcome: Outcome, amountKobo: number): Promise<ActionResult<BetResult>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in to bet." };
  if ((outcome !== "YES" && outcome !== "NO") || !Number.isInteger(amountKobo) || amountKobo <= 0) {
    return { ok: false, error: "Invalid bet." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bet", {
    p_market: marketId,
    p_outcome: outcome,
    p_amount_kobo: amountKobo,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/wallet");
  return { ok: true, value: data as BetResult };
}
