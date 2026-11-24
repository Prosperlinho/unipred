"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const PLATFORMS = ["x", "instagram", "tiktok", "whatsapp", "telegram", "youtube", "facebook", "other"] as const;

/** Claims today's trading-streak reward into the wallet. */
export async function claimStreak(): Promise<ActionResult<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_streak");
  if (error) return { ok: false, error: friendlyError(error.message) };
  const r = data as { streak: number; amount_kobo: number };
  revalidatePath("/", "layout");
  return { ok: true, value: `Day ${r.streak} streak claimed: ${formatNaira(r.amount_kobo)} added to your wallet.` };
}

/** Claims a one-time task reward into the wallet. */
export async function claimTask(taskId: string): Promise<ActionResult<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return { ok: false, error: "Unknown task." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_task", { p_task: taskId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const r = data as { amount_kobo: number };
  revalidatePath("/", "layout");
  return { ok: true, value: `${formatNaira(r.amount_kobo)} added to your wallet.` };
}

async function assertAdmin(): Promise<string | null> {
  const viewer = await getViewer();
  return viewer?.profile.is_admin ? null : "Admins only.";
}

/** Admin: the 7 daily streak rewards, in naira. */
export async function setStreakRewards(naira: number[]): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (naira.length !== 7 || naira.some((n) => !Number.isFinite(n) || n < 0 || n > 100_000)) {
    return { ok: false, error: "Enter 7 amounts between ₦0 and ₦100,000." };
  }
  const { error } = await createAdminClient()
    .from("settings")
    .update({ streak_rewards_kobo: naira.map((n) => Math.round(n) * 100) })
    .eq("id", 1);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  revalidatePath("/tasks");
  return { ok: true, value: undefined };
}

export interface TaskInput {
  id?: string;
  title: string;
  description: string;
  url: string;
  platform: string;
  rewardNaira: number;
  active: boolean;
}

/** Admin: create or edit a social task. */
export async function saveTask(t: TaskInput): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const title = t.title.trim();
  const url = t.url.trim();
  if (title.length < 2 || title.length > 80) return { ok: false, error: "Give the task a short title." };
  if (!/^https:\/\/\S+$/.test(url)) return { ok: false, error: "The link must start with https://" };
  if (!PLATFORMS.includes(t.platform as (typeof PLATFORMS)[number])) return { ok: false, error: "Pick a platform." };
  if (!(t.rewardNaira >= 0 && t.rewardNaira <= 100_000)) return { ok: false, error: "Reward must be between ₦0 and ₦100,000." };
  const row = {
    title,
    description: t.description.trim().slice(0, 200),
    url,
    platform: t.platform,
    reward_kobo: Math.round(t.rewardNaira) * 100,
    active: t.active,
  };
  const admin = createAdminClient();
  const { error } = t.id ? await admin.from("reward_tasks").update(row).eq("id", t.id) : await admin.from("reward_tasks").insert(row);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  revalidatePath("/tasks");
  return { ok: true, value: undefined };
}

/** Admin: delete a task (its past claims stay in wallet history). */
export async function deleteTask(id: string): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await createAdminClient().from("reward_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  revalidatePath("/tasks");
  return { ok: true, value: undefined };
}
