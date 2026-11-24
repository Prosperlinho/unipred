import "server-only";
import webpush from "web-push";
import { tradeWording } from "@/lib/wording";
import { createAdminClient } from "@/lib/supabase/admin";

/** Notification emails are switched off: members get in-app and phone notifications only. */
const EMAIL_KINDS = new Set<string>();
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://unipred.site";
const FROM = process.env.NOTIFY_FROM_EMAIL || "UniPred <noreply@unipred.site>";

interface Pending {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  email: string | null;
  want_email: boolean;
  emailed: boolean;
}

/**
 * VAPID keys for web push. Generated once and kept in app_secrets, so there's nothing to configure.
 */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  if (map.get("vapid_public") && map.get("vapid_private")) {
    return { publicKey: map.get("vapid_public")!, privateKey: map.get("vapid_private")! };
  }
  const keys = webpush.generateVAPIDKeys();
  // ignoreDuplicates: if two requests race, the first write wins and we re-read it.
  await admin.from("app_secrets").upsert(
    [
      { key: "vapid_public", value: keys.publicKey },
      { key: "vapid_private", value: keys.privateKey },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );
  const { data: again } = await admin.from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  const m2 = new Map((again ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return { publicKey: m2.get("vapid_public") ?? keys.publicKey, privateKey: m2.get("vapid_private") ?? keys.privateKey };
}

function emailHtml(n: Pending): string {
  const link = `${SITE}${n.url ?? "/"}`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html><body style="margin:0;background:#08170f;font-family:Arial,sans-serif;color:#f3efe6">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:480px;background:#0e2219;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:800;color:#c6f432">UniPred</td></tr>
<tr><td style="padding-top:18px;font-size:22px;font-weight:800;color:#ffffff">${esc(tradeWording(n.title))}</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#cfd8d2">${esc(tradeWording(n.body))}</td></tr>
<tr><td style="padding-top:22px"><a href="${link}" style="display:inline-block;background:#c6f432;color:#08170f;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:12px">Open UniPred</a></td></tr>
<tr><td style="padding-top:22px;font-size:11px;color:#8ba596">You can turn these emails off in Settings. 18+ only.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(n: Pending): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !n.email) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [n.email], subject: n.title, html: emailHtml(n) }),
  });
  return res.ok;
}

/**
 * Sends every undelivered notification as a phone notification (to each of the member's devices)
 * and, for important kinds, an email. Safe to call often; each notification goes out once.
 */
export async function dispatchNotifications(): Promise<{ pushed: number; emailed: number }> {
  // Keep sending in batches of 200 until everything is out (bounded so one call never runs too long).
  const started = Date.now();
  let pushed = 0;
  let emailed = 0;
  for (let round = 0; round < 15 && Date.now() - started < 45_000; round++) {
    const r = await dispatchBatch();
    pushed += r.pushed;
    emailed += r.emailed;
    if (r.processed < 200) break;
  }
  return { pushed, emailed };
}

async function dispatchBatch(): Promise<{ pushed: number; emailed: number; processed: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("notifications_to_deliver", { p_limit: 200 });
  if (error || !data || (data as Pending[]).length === 0) return { pushed: 0, emailed: 0, processed: 0 };
  const pending = data as Pending[];

  const { publicKey, privateKey } = await getVapidKeys();
  webpush.setVapidDetails(SITE, publicKey, privateKey);

  const userIds = [...new Set(pending.map((p) => p.user_id))];
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  const byUser = new Map<string, Array<{ id: string; endpoint: string; p256dh: string; auth: string }>>();
  for (const s of (subs ?? []) as Array<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>) {
    byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  }

  const done: number[] = [];
  const emailed: number[] = [];
  const dead = new Set<string>();
  let pushed = 0;

  for (const n of pending) {
    const payload = JSON.stringify({ title: tradeWording(n.title), body: tradeWording(n.body), url: n.url ?? "/", tag: `n${n.id}` });
    for (const s of byUser.get(n.user_id) ?? []) {
      if (dead.has(s.id)) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 });
        pushed++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.add(s.id); // device unsubscribed
      }
    }
    if (EMAIL_KINDS.has(n.kind) && n.want_email && !n.emailed) {
      try {
        if (await sendEmail(n)) emailed.push(n.id);
      } catch {
        // Email is best-effort; the in-app notification is still there.
      }
    }
    done.push(n.id);
  }

  if (dead.size) await admin.from("push_subscriptions").delete().in("id", [...dead]);
  await admin.rpc("mark_notifications_sent", { p_ids: done, p_emailed: emailed });
  return { pushed, emailed: emailed.length, processed: pending.length };
}
