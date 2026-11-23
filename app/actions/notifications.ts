"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** Marks all of the member's notifications as read. */
export async function markAllRead(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

/** Saves this device's push subscription so phone notifications can reach it. */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: "Invalid subscription." };
  // A device belongs to whoever is logged in on it now. If the same phone was used by another
  // account before, move it over (the member's own login can't touch that old row, so use the server key).
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ user_id: viewer.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, value: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true, value: undefined };
}

/** Email notifications on/off. */
export async function setNotifyEmail(on: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notify_email: on }).eq("id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/settings");
  return { ok: true, value: undefined };
}
