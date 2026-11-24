"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError, getSettings } from "@/lib/data";
import { isValidFullName, namesMatch } from "@/lib/identity";
import { paystack } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, FormState } from "@/lib/types";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const ACCOUNT_RE = /^\d{10}$/;
/** Verifying bank accounts that aren't in your name this many times suspends the account. */
const MAX_NAME_STRIKES = 3;

/** Username and school only: the full name is locked once set. */
export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in." };
  const username = String(fd.get("username") ?? "").trim();
  const schoolId = String(fd.get("school_id") ?? "").trim();
  if (!USERNAME_RE.test(username)) return { error: "Username must be 3-20 letters, numbers or underscores." };
  if (schoolId === "all") return { error: "Choose your own university." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ username, school_id: schoolId }).eq("id", viewer.id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

/** One-time: for accounts created before full names were required. */
export async function setFullName(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await getViewer())) return { error: "Please log in." };
  const name = String(fd.get("full_name") ?? "").trim();
  if (!isValidFullName(name)) return { error: "Enter your first and last name exactly as on your bank account." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_full_name", { p_name: name });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { message: "Full name saved. It can't be changed again." };
}

export async function acceptTerms(): Promise<ActionResult> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  const settings = await getSettings();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_terms", { p_version: settings.terms_version });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function finishOnboarding(): Promise<ActionResult> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  await supabase.rpc("mark_onboarded");
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

async function suspend(userId: string, reason: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_banned: true, ban_reason: reason }).eq("id", userId);
  revalidatePath("/", "layout");
}

export interface ResolvedAccount {
  accountName: string;
  matches: boolean;
  strikesLeft: number;
}

/**
 * Looks up the account holder's name and checks it against the user's locked full name.
 * Repeatedly verifying accounts in someone else's name suspends the UniPred account.
 */
export async function resolveBankAccount(bankCode: string, accountNumber: string): Promise<ActionResult<ResolvedAccount>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  if (viewer.profile.is_banned) return { ok: false, error: "Your account is suspended. Contact UniPred support." };
  if (!isValidFullName(viewer.profile.full_name)) {
    return { ok: false, error: "Set your full name in Settings first. It must match your bank account." };
  }
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { ok: false, error: "Enter a 10-digit account number." };
  try {
    const res = await paystack.resolveAccount(accountNumber, bankCode);
    const matches = namesMatch(viewer.profile.full_name, res.account_name);
    let strikes = viewer.profile.payout_name_strikes;
    if (!matches) {
      strikes += 1;
      const admin = createAdminClient();
      await admin.from("profiles").update({ payout_name_strikes: strikes }).eq("id", viewer.id);
      if (strikes >= MAX_NAME_STRIKES) {
        await suspend(viewer.id, `Tried ${strikes} bank accounts not in their name (last: ${res.account_name})`);
        return { ok: false, error: "Your account has been suspended for trying bank accounts that aren't in your name." };
      }
    }
    return { ok: true, value: { accountName: res.account_name, matches, strikesLeft: MAX_NAME_STRIKES - strikes } };
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
  if (viewer.profile.is_banned) return { ok: false, error: "Your account is suspended. Contact UniPred support." };
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { ok: false, error: "Enter a 10-digit account number." };
  try {
    // Re-resolve server-side: never trust an account name sent by the browser.
    const resolved = await paystack.resolveAccount(accountNumber, bankCode);
    if (!namesMatch(viewer.profile.full_name, resolved.account_name)) {
      // The app never offers to save a mismatched account, so this is a deliberate attempt.
      await suspend(viewer.id, `Tried to save a bank account in another name (${resolved.account_name})`);
      return { ok: false, error: "That account isn't in your name. Your account has been suspended for review." };
    }

    const admin = createAdminClient();
    const { data: taken } = await admin
      .from("payout_accounts")
      .select("user_id")
      .eq("bank_code", bankCode)
      .eq("account_number", accountNumber)
      .neq("user_id", viewer.id)
      .maybeSingle<{ user_id: string }>();
    if (taken) {
      // Same bank account on two UniPred accounts = one person with multiple accounts.
      await suspend(viewer.id, "Bank account already linked to another UniPred account (multiple accounts)");
      return { ok: false, error: "That bank account belongs to another UniPred account. This account has been suspended." };
    }

    const recipient = await paystack.createRecipient({
      name: resolved.account_name,
      account_number: accountNumber,
      bank_code: bankCode,
    });
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

/** Show or hide the signed-in member on the public leaderboard. */
export async function setLeaderboardHidden(hidden: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ leaderboard_hidden: hidden }).eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/leaderboard");
  revalidatePath("/settings");
  return { ok: true, value: undefined };
}

/** Saves the market categories the member wants to see. */
export async function setInterests(interests: string[]): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const { CATEGORIES } = await import("@/lib/types");
  const clean = [...new Set(interests)].filter((c) => (CATEGORIES as readonly string[]).includes(c));
  if (clean.length === 0) return { ok: false, error: "Pick at least one." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ interests: clean }).eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}
