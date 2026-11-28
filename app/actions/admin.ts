"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { dispatchNotifications } from "@/lib/notify";
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
  updateTag("leaderboard"); // results count on the leaderboard straight away
}

export async function approveMarket(id: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_market", { p_market: id });
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
  after(() => dispatchNotifications().catch(() => undefined));
  const r = data as { winners: number; paid_kobo: number; fee_kobo?: number; referral_kobo?: number };
  return {
    ok: true,
    value: `Resolved ${outcome}. Paid ${formatNaira(r.paid_kobo)} to ${r.winners} winner(s). UniPred fee: ${formatNaira(r.fee_kobo ?? 0)}. Invite bonuses: ${formatNaira(r.referral_kobo ?? 0)}.`,
  };
}

export async function cancelMarket(id: string, note: string): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_market", { p_market: id, p_note: note.trim() || "Cancelled" });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  after(() => dispatchNotifications().catch(() => undefined));
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

/** Suspend or restore an account after review. Clearing also removes any flag. */
export async function setAccountStatus(userId: string, suspend: boolean, reason: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(
      suspend
        ? { is_banned: true, ban_reason: reason.trim() || "Suspended by admin" }
        : { is_banned: false, ban_reason: null, flagged_reason: null, payout_name_strikes: 0, payer_check_waived: true },
    )
    .eq("id", userId);
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  return { ok: true, value: undefined };
}

/** Gives a partner a special invite rate (percent of UniPred's fee), or null to go back to the standard rate. */
export async function setPartnerRate(username: string, ratePct: number | null): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (ratePct !== null && !(ratePct >= 0 && ratePct <= 100)) return { ok: false, error: "Rate must be between 0% and 100%." };
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", username.trim().replace(/^@/, "").replace(/_/g, "\\_"))
    .maybeSingle<{ id: string; username: string }>();
  if (!user) return { ok: false, error: "No member with that username." };
  const { error } = await admin
    .from("profiles")
    .update({ referral_bps_override: ratePct === null ? null : Math.round(ratePct * 100) })
    .eq("id", user.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return {
    ok: true,
    value: ratePct === null ? `@${user.username} is back on the standard rate.` : `@${user.username} now earns ${ratePct}% of the fee.`,
  };
}

/** Lets a member propose markets, or takes that away. */
export async function setProposerAccess(username: string, allow: boolean): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", username.trim().replace(/^@/, "").replace(/_/g, "\\_"))
    .maybeSingle<{ id: string; username: string }>();
  if (!user) return { ok: false, error: "No member with that username." };
  const { error } = await admin.from("profiles").update({ can_propose: allow }).eq("id", user.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: true, value: allow ? `@${user.username} can now propose markets.` : `@${user.username} can no longer propose markets.` };
}

export interface ScheduleInput {
  schoolId: string;
  category: string;
  question: string;
  criteria: string;
  source: string;
  cadence: "daily" | "weekly";
  weekday: number; // 0 = Sunday, used when weekly
  runHour: number; // Lagos time
  closeAfterHours: number;
}

/** Next time (UTC) a schedule should run: the given Lagos hour, today or later (and on the weekday if weekly). */
function nextRunAt(cadence: "daily" | "weekly", weekday: number, runHour: number): string {
  const LAGOS_OFFSET_H = 1; // West Africa Time, no daylight saving
  const now = Date.now();
  const lagosNow = new Date(now + LAGOS_OFFSET_H * 3_600_000);
  const at = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate(), runHour - LAGOS_OFFSET_H));
  while (at.getTime() <= now || (cadence === "weekly" && new Date(at.getTime() + LAGOS_OFFSET_H * 3_600_000).getUTCDay() !== weekday)) {
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return at.toISOString();
}

/** Creates a market that goes live automatically every day or week. */
export async function createSchedule(input: ScheduleInput): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const viewer = await getViewer();
  const q = input.question.trim();
  if (q.length < 12 || q.length > 160 || !q.endsWith("?")) return { ok: false, error: "Question must be 12-160 characters and end with '?'." };
  if (input.criteria.trim().length < 10) return { ok: false, error: "Describe exactly what has to happen for YES." };
  if (input.source.trim().length < 2) return { ok: false, error: "Add where the result will be confirmed." };
  if (!(input.runHour >= 0 && input.runHour <= 23)) return { ok: false, error: "Pick an hour between 0 and 23." };
  if (!(input.closeAfterHours >= 1 && input.closeAfterHours <= 2880)) return { ok: false, error: "Closing time must be 1 hour to 120 days after it goes live." };
  const admin = createAdminClient();
  const { error } = await admin.from("market_schedules").insert({
    school_id: input.schoolId,
    category: input.category,
    question: q,
    criteria: input.criteria.trim(),
    source: input.source.trim(),
    cadence: input.cadence,
    weekday: input.cadence === "weekly" ? input.weekday : null,
    run_hour: input.runHour,
    close_after_hours: input.closeAfterHours,
    next_run_at: nextRunAt(input.cadence, input.weekday, input.runHour),
    created_by: viewer!.id,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: true, value: undefined };
}

export async function setScheduleActive(id: string, active: boolean): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("market_schedules")
    .select("cadence, weekday, run_hour")
    .eq("id", id)
    .maybeSingle<{ cadence: "daily" | "weekly"; weekday: number | null; run_hour: number }>();
  if (!s) return { ok: false, error: "Schedule not found." };
  // Resuming starts from the next slot, so paused days aren't all created at once.
  const patch = active ? { active, next_run_at: nextRunAt(s.cadence, s.weekday ?? 0, s.run_hour) } : { active };
  const { error } = await admin.from("market_schedules").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: true, value: undefined };
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  const { error } = await admin.from("market_schedules").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: true, value: undefined };
}

/** Makes a market the "Market of the day" (pinned first), or clears it with null. */
export async function featureMarket(id: string | null): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = createAdminClient();
  await admin.from("markets").update({ featured_at: null }).not("featured_at", "is", null);
  if (id) {
    const { error } = await admin.from("markets").update({ featured_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: friendlyError(error.message) };
  }
  refreshAll();
  return { ok: true, value: undefined };
}

/** Sets the fixed prize pool for a week (Monday date, YYYY-MM-DD). */
export async function setWeeklyPool(weekStart: string, naira: number): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { ok: false, error: "Invalid week." };
  if (!(naira >= 0 && naira <= 100_000_000)) return { ok: false, error: "Enter an amount in naira." };
  const admin = createAdminClient();
  const { data: existing } = await admin.from("weekly_prizes").select("status").eq("week_start", weekStart).maybeSingle<{ status: string }>();
  if (existing?.status === "paid") return { ok: false, error: "That week's prizes were already paid." };
  const { error } = await admin
    .from("weekly_prizes")
    .upsert({ week_start: weekStart, pool_kobo: Math.round(naira * 100), updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, value: undefined };
}

/** Pays the top 5 of a finished week into their wallets. */
export async function payWeeklyPrizes(weekStart: string): Promise<ActionResult<string>> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pay_weekly_prizes", { p_week: weekStart });
  if (error) return { ok: false, error: friendlyError(error.message) };
  refreshAll();
  after(() => dispatchNotifications().catch(() => undefined));
  const r = data as { winners: number; paid_kobo: number; unused_kobo: number };
  return {
    ok: true,
    value: `Paid ${formatNaira(r.paid_kobo)} to ${r.winners} winner(s).${r.unused_kobo > 0 ? ` ${formatNaira(r.unused_kobo)} unused (fewer than 5 qualified).` : ""}`,
  };
}

const BANNER_PLACEMENTS = ["home", "markets", "leaderboard"] as const;

function httpsUrlOrNull(v: FormDataEntryValue | null): string | null | undefined {
  const t = String(v ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    u.protocol = "https:";
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Creates a sponsor banner. Image: an uploaded file (stored in the public "banners" bucket) or a pasted link. */
export async function createBanner(fd: FormData): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const sponsor = String(fd.get("sponsor") ?? "").trim().slice(0, 60);
  const title = String(fd.get("title") ?? "").trim().slice(0, 80);
  const description = String(fd.get("description") ?? "").trim().slice(0, 240);
  const cta = String(fd.get("cta") ?? "").trim().slice(0, 24);
  const placements = fd.getAll("placements").map(String).filter((p) => (BANNER_PLACEMENTS as readonly string[]).includes(p));
  const link = httpsUrlOrNull(fd.get("link_url"));
  let image = httpsUrlOrNull(fd.get("image_url"));
  if (!sponsor || !title) return { ok: false, error: "Add the sponsor's name and a title." };
  if (placements.length === 0) return { ok: false, error: "Pick at least one place to show it." };
  if (link === undefined || image === undefined) return { ok: false, error: "One of the links isn't a valid web address." };

  const admin = createAdminClient();
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return { ok: false, error: "The image must be PNG, JPG, WEBP or GIF." };
    if (file.size > 3 * 1024 * 1024) return { ok: false, error: "The image is too big (max 3MB)." };
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await admin.storage.from("banners").upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "31536000",
    });
    if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };
    image = admin.storage.from("banners").getPublicUrl(path).data.publicUrl;
  }

  const startsAt = String(fd.get("starts_at") ?? "");
  const endsAt = String(fd.get("ends_at") ?? "");
  const { error } = await admin.from("sponsor_banners").insert({
    sponsor,
    title,
    description: description || null,
    cta: cta || null,
    link_url: link,
    image_url: image,
    placements,
    starts_at: startsAt ? new Date(`${startsAt}T00:00:00+01:00`).toISOString() : null,
    ends_at: endsAt ? new Date(`${endsAt}T23:59:59+01:00`).toISOString() : null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function setBannerActive(id: string, active: boolean): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await createAdminClient().from("sponsor_banners").update({ active }).eq("id", id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await createAdminClient().from("sponsor_banners").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

/** Starting house liquidity for NEW live-price markets (existing markets keep theirs). */
export async function setMarketLiquidity(naira: number): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!Number.isFinite(naira) || naira < 10_000 || naira > 5_000_000) return { ok: false, error: "Enter an amount between ₦10,000 and ₦5,000,000." };
  const { error } = await createAdminClient().from("settings").update({ amm_liquidity_kobo: Math.round(naira) * 100 }).eq("id", 1);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  return { ok: true, value: undefined };
}
