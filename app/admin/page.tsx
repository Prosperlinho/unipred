import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { getRequestTime } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";
import { getSchools } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Market, Withdrawal } from "@/lib/types";
import { OpenMarketRow, PendingMarketCard, WithdrawalRow } from "./AdminPanels";

export const metadata: Metadata = { title: "Admin · UniPred" };

function Section({ title, count, children, empty }: { title: string; count: number; children: ReactNode; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        {title}
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-white">{count}</span>
      </h2>
      {count === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const [schools, { data: pendingData }, { data: openData }, { data: wData }] = await Promise.all([
    getSchools(),
    admin.from("markets").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    admin.from("markets").select("*").eq("status", "open").order("closes_at", { ascending: true }),
    admin.from("withdrawals").select("*").in("status", ["pending", "processing"]).order("created_at", { ascending: true }),
  ]);
  const pending = (pendingData ?? []) as Market[];
  const open = (openData ?? []) as Market[];
  const withdrawals = (wData ?? []) as Withdrawal[];

  const userIds = [...new Set([...pending.map((m) => m.created_by), ...withdrawals.map((w) => w.user_id)].filter(Boolean))] as string[];
  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as Array<{ id: string; username: string }> };
  const nameOf = new Map((users ?? []).map((u) => [u.id, u.username]));
  const schoolOf = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const now = getRequestTime();
  const needsResult = open.filter((m) => new Date(m.closes_at).getTime() <= now).length;

  return (
    <Container>
      <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin</h1>
      <p className="mb-6 text-sm text-muted">
        {pending.length} proposals to review · {needsResult} closed markets need a result · {withdrawals.length} withdrawals
      </p>

      <div className="space-y-8">
        <Section title="Proposals to review" count={pending.length} empty="No proposals waiting.">
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((m) => (
              <PendingMarketCard
                key={m.id}
                market={m}
                proposer={nameOf.get(m.created_by ?? "") ?? "unknown"}
                school={schoolOf[m.school_id] ?? m.school_id}
              />
            ))}
          </div>
        </Section>

        <Section title="Withdrawals" count={withdrawals.length} empty="No withdrawals waiting.">
          <div className="grid gap-3 lg:grid-cols-3">
            {withdrawals.map((w) => (
              <WithdrawalRow key={w.id} w={w} username={nameOf.get(w.user_id) ?? "unknown"} />
            ))}
          </div>
        </Section>

        <Section title="Live markets (resolve or cancel)" count={open.length} empty="No live markets.">
          <div className="grid gap-3 lg:grid-cols-2">
            {open.map((m) => (
              <OpenMarketRow key={m.id} market={m} school={schoolOf[m.school_id] ?? m.school_id} now={now} />
            ))}
          </div>
        </Section>
      </div>
    </Container>
  );
}
