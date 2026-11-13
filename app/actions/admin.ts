"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { friendlyError } from "@/lib/data";
import { paystack } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Outcome } from "@/lib/types";

async function assertAdmin(): Promise<string | null> {
  const viewer = await getViewer();
  return viewer?.profile.is_admin ? null : "Admins only.";
}

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function approveMarket(id: string, probPct: number, liquidityNaira: number): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!(probPct >= 5 && probPct <= 95)) return { ok: false, error: "Starting odds must be between 5% and 95%." };
  if (!(liquidityNaira >= 1000)) return { ok: false, error: "Liquidity must be at least ₦1,000." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_market", {
    p_market: id,
    p_initial_prob: probPct / 100,
    p_liquidity_kobo: Math.round(liquidityNaira * 100),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  return { ok: true, value: undefined };
}

export async function rejectMarket(id: string, note: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_market", { p_market: id, p_note: note.trim() || "Not approved" });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  return { ok: true, value: undefined };
}

export async function resolveMarket(id: string, outcome: Outcome): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_market", { p_market: id, p_outcome: outcome });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  const r = data as { winners: number; paid_kobo: number };
  return { ok: true, value: `Resolved ${outcome}. Paid ${formatNaira(r.paid_kobo)} to ${r.winners} winner(s).` };
}

export async function cancelMarket(id: string, note: string): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_market", { p_market: id, p_note: note.trim() || "Cancelled" });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  const r = data as { refunded_kobo: number };
  return { ok: true, value: `Market cancelled. Refunded ${formatNaira(r.refunded_kobo)}.` };
}

/** Sends the money with a Paystack transfer. Final status arrives via the webhook. */
export async function approveWithdrawal(id: string): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { data: w } = await admin
    .from("withdrawals")
    .select("id, amount_kobo, recipient_code, status")
    .eq("id", id)
    .maybeSingle<{ id: string; amount_kobo: number; recipient_code: string; status: string }>();
  if (!w || w.status !== "pending") return { ok: false, error: "This withdrawal is no longer pending." };

  try {
    const t = await paystack.transfer({
      amount: w.amount_kobo,
      recipient: w.recipient_code,
      reference: w.id,
      reason: "UniPred withdrawal",
    });
    if (t.status === "success") {
      await admin.rpc("complete_withdrawal", { p_id: w.id });
    } else {
      await admin.rpc("mark_withdrawal_processing", { p_id: w.id, p_transfer_code: t.transfer_code });
    }
    refreshAll();
    return { ok: true, value: t.status === "success" ? "Transfer completed." : `Transfer ${t.status}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed." };
  }
}

export async function rejectWithdrawal(id: string, note: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fail_withdrawal", {
    p_id: id,
    p_status: "rejected",
    p_note: note.trim() || "Rejected by admin",
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  if (!data) return { ok: false, error: "This withdrawal is no longer pending." };
  refreshAll();
  return { ok: true, value: undefined };
}
