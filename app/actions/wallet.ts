"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError, getSettings } from "@/lib/data";
import { getOrigin } from "@/lib/origin";
import { PaystackError, paystack } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const MAX_DEPOSIT_KOBO = 50_000_000; // ₦500,000 per deposit

/** Creates a pending deposit and returns the Paystack checkout URL. */
export async function startDeposit(amountKobo: number): Promise<ActionResult<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in to fund your wallet." };
  const settings = await getSettings();
  if (!Number.isInteger(amountKobo) || amountKobo < settings.min_deposit_kobo) {
    return { ok: false, error: `Minimum deposit is ₦${(settings.min_deposit_kobo / 100).toLocaleString()}.` };
  }
  if (amountKobo > MAX_DEPOSIT_KOBO) return { ok: false, error: "Maximum deposit is ₦500,000 at a time." };

  const reference = `dep_${randomUUID().replace(/-/g, "")}`;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("deposits")
      .insert({ reference, user_id: viewer.id, amount_kobo: amountKobo });
    if (error) return { ok: false, error: friendlyError(error.message) };

    const origin = await getOrigin();
    const checkout = await paystack.initializeTransaction({
      email: viewer.email,
      amount: amountKobo,
      reference,
      callback_url: `${origin}/wallet/verify`,
      metadata: { user_id: viewer.id, purpose: "wallet_funding" },
    });
    return { ok: true, value: checkout.authorization_url };
  } catch (e) {
    return { ok: false, error: e instanceof PaystackError || e instanceof Error ? e.message : "Could not start payment." };
  }
}

/** Holds the amount from the wallet and queues a withdrawal for admin approval. */
export async function requestWithdrawal(amountKobo: number): Promise<ActionResult<string>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) return { ok: false, error: "Enter an amount." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_withdrawal", { p_amount_kobo: amountKobo });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/wallet");
  return { ok: true, value: data as string };
}
