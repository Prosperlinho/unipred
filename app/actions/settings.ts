"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { paystack } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, FormState } from "@/lib/types";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const ACCOUNT_RE = /^\d{10}$/;

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in." };
  const username = String(fd.get("username") ?? "").trim();
  const fullName = String(fd.get("full_name") ?? "").trim();
  const schoolId = String(fd.get("school_id") ?? "").trim();
  if (!USERNAME_RE.test(username)) return { error: "Username must be 3-20 letters, numbers or underscores." };
  if (fullName.length > 80) return { error: "Full name is too long." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username, full_name: fullName, school_id: schoolId })
    .eq("id", viewer.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

/** Looks up the account holder's name so the user can confirm it before saving. */
export async function resolveBankAccount(bankCode: string, accountNumber: string): Promise<ActionResult<string>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { ok: false, error: "Enter a 10-digit account number." };
  try {
    const res = await paystack.resolveAccount(accountNumber, bankCode);
    return { ok: true, value: res.account_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not verify that account." };
  }
}

export async function savePayoutAccount(
  bankCode: string,
  bankName: string,
  accountNumber: string,
): Promise<ActionResult<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { ok: false, error: "Enter a 10-digit account number." };
  try {
    // Re-resolve server-side: never trust an account name sent by the browser.
    const resolved = await paystack.resolveAccount(accountNumber, bankCode);
    const recipient = await paystack.createRecipient({
      name: resolved.account_name,
      account_number: accountNumber,
      bank_code: bankCode,
    });
    const admin = createAdminClient();
    const { error } = await admin.from("payout_accounts").upsert({
      user_id: viewer.id,
      bank_code: bankCode,
      bank_name: bankName.slice(0, 120),
      account_number: accountNumber,
      account_name: resolved.account_name,
      recipient_code: recipient.recipient_code,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: friendlyError(error.message) };
    revalidatePath("/settings");
    revalidatePath("/wallet");
    return { ok: true, value: resolved.account_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save that account." };
  }
}
