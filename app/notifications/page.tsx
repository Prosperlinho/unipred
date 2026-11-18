import { Bell, Clock, Gift, RotateCcw, Send, Sparkles, Trophy, XCircle, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertsCard } from "@/components/AppAlerts";
import { Container } from "@/components/Container";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Notifications · UniPred" };

interface Note {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
}

const KIND: Record<string, { Icon: LucideIcon; tone: string }> = {
  won: { Icon: Trophy, tone: "bg-yes/15 text-yes" },
  lost: { Icon: XCircle, tone: "bg-white/10 text-white" },
  refund: { Icon: RotateCcw, tone: "bg-amber-400/15 text-amber-300" },
  closing_soon: { Icon: Clock, tone: "bg-amber-400/15 text-amber-300" },
  new_market: { Icon: Sparkles, tone: "bg-brand/15 text-brand" },
  transfer_in: { Icon: Send, tone: "bg-yes/15 text-yes" },
  bonus: { Icon: Gift, tone: "bg-brand/15 text-brand" },
  prize: { Icon: Trophy, tone: "bg-amber-400/15 text-amber-300" },
};

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, url, created_at, read_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const notes = (data ?? []) as Note[];
  const unread = notes.some((n) => !n.read_at);

  return (
    <Container narrow>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        <Bell className="size-6 text-brand" /> Notifications
      </h1>
      {unread && <MarkRead />}

      <AlertsCard />

      <div className="mt-4 rounded-3xl border border-line bg-card">
        {notes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">Nothing yet. Make a call and we&apos;ll keep you posted.</p>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => {
              const k = KIND[n.kind] ?? { Icon: Bell, tone: "bg-white/10 text-white" };
              const row = (
                <>
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                    <k.Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">{n.title}</span>
                      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="New" />}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{ago(n.created_at)}</span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.url ? (
                    <Link href={n.url} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-card-2 ${n.read_at ? "" : "bg-brand/5"}`}>
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Container>
  );
}
