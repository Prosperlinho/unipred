"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { dispatchNotifications } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Outcome } from "@/lib/types";

const send = () => after(() => dispatchNotifications().catch(() => undefined));

export async function createRoom(name: string, description: string, isPublic: boolean): Promise<ActionResult<string>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_room", { p_name: name, p_description: description, p_public: isPublic });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/rooms");
  return { ok: true, value: (data as { id: string }).id };
}

/** Join a public room by id, or any room with its invite code. Returns the room id. */
export async function joinRoom(roomId: string | null, code: string | null): Promise<ActionResult<string>> {
  if (!(await getViewer())) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { p_room: roomId, p_code: code });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/rooms");
  return { ok: true, value: data as string };
}

export async function leaveRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_room", { p_room: roomId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/rooms");
  return { ok: true, value: undefined };
}

export async function dropRoomQuestion(
  roomId: string,
  question: string,
  details: string,
  category: string,
  closesAtIso: string,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("room_drop_question", {
    p_room: roomId,
    p_question: question,
    p_details: details,
    p_category: category,
    p_closes_at: closesAtIso,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/rooms/${roomId}`);
  send();
  return { ok: true, value: data as string };
}

/** Room host decides the result (the database checks they host this room). */
export async function resolveRoomQuestion(marketId: string, outcome: Outcome, roomId: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_market", { p_market: marketId, p_outcome: outcome });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/markets/${marketId}`);
  send();
  const r = data as { winners: number; paid_kobo: number };
  return { ok: true, value: `Resolved ${outcome}. Paid ${formatNaira(r.paid_kobo)} to ${r.winners} winner(s).` };
}

export async function cancelRoomQuestion(marketId: string, roomId: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_market", { p_market: marketId, p_note: "Cancelled by the room host" });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/rooms/${roomId}`);
  send();
  return { ok: true, value: `Cancelled. Refunded ${formatNaira((data as { refunded_kobo: number }).refunded_kobo)}.` };
}

/** UniPred admins: suspend or restore a room. */
export async function setRoomSuspended(roomId: string, suspended: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_room_suspended", { p_room: roomId, p_suspended: suspended });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin");
  revalidatePath("/rooms");
  return { ok: true, value: undefined };
}
