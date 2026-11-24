import { Globe2, GraduationCap, Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { AutoRefresh } from "@/components/LiveRefresh";
import { PersonalBoard } from "@/components/PersonalFeeds";
import { SchoolPicker } from "@/components/SchoolPicker";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getRequestTime } from "@/lib/time";
import { GENERAL_SCHOOL, GENERAL_SCHOOL_ID, type Market } from "@/lib/types";

export const metadata: Metadata = { title: "Markets · UniPred" };

/** ?school=<id> one university · ?school=general markets for all universities · ?school=all everything. */
export default async function MarketsPage(props: PageProps<"/markets">) {
  const searchParams = await props.searchParams;
  const [viewer, schools, settings] = await Promise.all([getViewer(), getActiveSchools(), getSettings()]);

  const requested = typeof searchParams.school === "string" ? searchParams.school : undefined;
  const validRequested =
    requested === "all" || requested === "general" || schools.some((s) => s.id === requested) ? requested : undefined;
  const ownSchool = schools.some((s) => s.id === viewer?.profile.school_id) ? viewer?.profile.school_id : undefined;
  const homeSchool = ownSchool ?? schools[0]?.id;
  const selected = validRequested ?? homeSchool ?? "all";
  const selectedSchool = schools.find((s) => s.id === selected);
  const tab: "school" | "general" | "all" = selected === "general" ? "general" : selected === "all" ? "all" : "school";

  const now = getRequestTime();
  const supabase = await createClient();
  let query = supabase
    .from("markets")
    .select("*")
    .eq("status", "open")
    .is("room_id", null)
    .gt("closes_at", new Date(now).toISOString())
    .order("created_at", { ascending: false })
    .limit(150);
  query =
    tab === "general"
      ? query.eq("school_id", GENERAL_SCHOOL_ID)
      : tab === "all"
        ? query.in("school_id", [...schools.map((s) => s.id), GENERAL_SCHOOL_ID])
        : query.eq("school_id", selected);
  const { data } = await query;
  const markets = (data ?? []) as Market[];
  const schoolLabels = { ...Object.fromEntries(schools.map((s) => [s.id, s.short_name])), [GENERAL_SCHOOL_ID]: GENERAL_SCHOOL.short_name };
  const canPropose = !!viewer && (!!viewer.profile.can_propose || viewer.profile.is_admin);
  const schoolTabId = tab === "school" ? selected : homeSchool;
  const schoolTabLabel = schools.find((s) => s.id === schoolTabId)?.short_name ?? "My university";

  const tabs = [
    { id: "school", href: `/markets?school=${schoolTabId ?? "all"}`, label: schoolTabLabel, Icon: GraduationCap },
    { id: "general", href: "/markets?school=general", label: "General", Icon: Globe2 },
    { id: "all", href: "/markets?school=all", label: "Everything", Icon: Layers },
  ] as const;

  return (
    <Container>
      <section className="space-y-4">
        <AutoRefresh intervalMs={60_000} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {tab === "general" ? "For all universities" : selectedSchool ? `Live at ${selectedSchool.short_name}` : "Live markets"}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {canPropose && (
              <Link href="/propose" className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-black">
                <Plus className="size-3.5" strokeWidth={3} /> Create
              </Link>
            )}
            <Link href="/rooms" className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand">
              Rooms →
            </Link>
          </div>
        </div>

        <nav className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-card p-1" aria-label="Which markets">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                tab === t.id ? "bg-brand text-black" : "text-muted hover:bg-card-2 hover:text-white"
              }`}
            >
              <t.Icon className="size-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </Link>
          ))}
        </nav>

        {tab === "general" && (
          <p className="text-xs text-muted">National questions everyone can trade on: exams, ASUU, sports, news and more, whatever your school.</p>
        )}
        {tab === "school" && schools.length > 1 && (
          <SchoolPicker schools={schools} selected={selected} mySchoolId={viewer?.profile.school_id ?? null} />
        )}

        <PersonalBoard
          saved={viewer?.profile.interests ?? null}
          loggedIn={!!viewer}
          canPropose={canPropose}
          markets={markets}
          schoolLabels={schoolLabels}
          showSchool={tab === "all"}
          serverNow={now}
          feeBps={settings.pool_fee_bps}
          emptyHint={tab === "general" ? "No general markets right now. New ones drop all the time." : "No live markets here right now. New ones drop all the time."}
        />
      </section>
    </Container>
  );
}
