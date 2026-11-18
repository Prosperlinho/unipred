import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/** Called every 10 minutes by the database job (pg_cron + pg_net) to send emails and phone notifications. */
export async function POST(req: NextRequest) {
  const given = req.headers.get("x-cron-secret") ?? "";
  const admin = createAdminClient();
  const { data } = await admin.from("app_secrets").select("value").eq("key", "cron_secret").maybeSingle<{ value: string }>();
  const expected = data?.value ?? "";
  const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Forbidden", { status: 403 });
  const result = await dispatchNotifications();
  return Response.json(result);
}
