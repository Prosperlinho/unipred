import "server-only";
import { isValidFullName, namesMatch } from "@/lib/identity";
import { createAdminClient } from "@/lib/supabase/admin";

/** Payer details Paystack may include on a successful charge (often empty for cards). */
export interface PayerInfo {
  authorization?: { account_name?: string | null; sender_name?: string | null } | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
}

/**
 * Best effort: when Paystack tells us who paid and it isn't the member,
 * flag the account for admin review. Never blocks the deposit itself.
 */
export async function checkDepositPayer(reference: string, payer: PayerInfo) {
  const name = payer.authorization?.sender_name || payer.authorization?.account_name || "";
  if (!name.trim()) return;
  const admin = createAdminClient();
  const { data: dep } = await admin.from("deposits").select("user_id").eq("reference", reference).maybeSingle<{ user_id: string }>();
  if (!dep) return;
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, payer_check_waived")
    .eq("id", dep.user_id)
    .maybeSingle<{ full_name: string; payer_check_waived: boolean | null }>();
  if (!profile || !isValidFullName(profile.full_name)) return;
  // An admin already reviewed and cleared this member: don't flag them again for the payer name.
  if (profile.payer_check_waived) return;
  if (!namesMatch(profile.full_name, name)) {
    await admin
      .from("profiles")
      .update({ flagged_reason: `Deposit ${reference} paid by "${name.slice(0, 80)}", not the account holder` })
      .eq("id", dep.user_id);
  }
}
