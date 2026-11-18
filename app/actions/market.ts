"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchNotifications } from "@/lib/notify";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type ActionResult, type FormState, type Outcome } from "@/lib/types";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function proposeMarket(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await getViewer())) return { error: "Please log in to propose a market." };

  const question = str(fd, "question");
  const category = str(fd, "category");
  const criteria = str(fd, "criteria");
  const source = str(fd, "source");
  const schoolId = str(fd, "school_id");
  // The browser sends its local time plus its UTC offset so we store the right instant.
  const closesLocal = str(fd, "closes_at");
  const offsetMin = Number(str(fd, "tz_offset"));
  const closesAt = new Date(`${closesLocal}:00Z`).getTime() + (Number.isFinite(offsetMin) ? offsetMin : 0) * 60_000;

  const values = { question, category, criteria, source, school_id: schoolId, closes_at: closesLocal };
  const fail = (error: string): FormState => ({ error, values });

  if (question.length < 12 || question.length > 160) return fail("Question must be 12-160 characters.");
  if (!question.endsWith("?")) return fail("Phrase it as a Yes/No question ending with '?'.");
  if (!(CATEGORIES as readonly string[]).includes(category)) return fail("Choose a category.");
  if (criteria.length < 10) return fail("Describe exactly what has to happen for YES.");
  if (criteria.length > 300) return fail("Keep the YES condition under 300 characters.");
  if (source.length < 2) return fail("Add where the result will be confirmed.");
  if (!schoolId) return fail("Choose the university this market is about.");
  if (!Number.isFinite(closesAt)) return fail("Choose a closing date and time.");
  if (/\[[^\]]*\]/.test(question + criteria + source)) return fail("Fill in the [blanks] from the template first.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propose_market", {
    p_school: schoolId,
    p_question: question,
    p_category: category,
    p_criteria: criteria,
    p_source: source,
    p_closes_at: new Date(closesAt).toISOString(),
  });
  if (error) return fail(friendlyError(error.message));

  const result = data as { id: string; status: "open" | "pending" };
  revalidatePath("/", "layout");
  if (result.status === "open") after(() => dispatchNotifications().catch(() => undefined));
  if (result.status === "open") redirect(`/markets/${result.id}?new=1`);
  redirect("/portfolio?proposed=1");
}

export async function postComment(marketId: string, body: string, side: Outcome | null): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in to join the banter." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Comment can't be empty." };
  if (text.length > 280) return { ok: false, error: "Keep it under 280 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ market_id: marketId, user_id: viewer.id, body: text, side: side === "YES" || side === "NO" ? side : null });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/markets/${marketId}`);
  return { ok: true, value: undefined };
}

export async function deleteComment(marketId: string, commentId: number): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in." };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", viewer.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/markets/${marketId}`);
  return { ok: true, value: undefined };
}
