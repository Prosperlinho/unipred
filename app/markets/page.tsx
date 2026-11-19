import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { AutoRefresh } from "@/components/LiveRefresh";
import { PersonalBoard } from "@/components/PersonalFeeds";
import { SchoolPicker } from "@/components/SchoolPicker";
import { SponsorBanner } from "@/components/SponsorBanner";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getBanner, getSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getRequestTime } from "@/lib/time";
import type { Market } from "@/lib/types";

export const metadata: Metadata = { title: "Markets · UniPred" };

export default async function MarketsPage(props: PageProps<"/markets">) {
  const searchParams = await props.searchParams;
  const [viewer, schools, settings, banner] = await Promise.all([getViewer(), getActiveSchools(), getSettings(), getBanner("markets")]);

  const requested = typeof searchParams.school === "string" ? searchParams.school : undefined;
  const validRequested = requested === "all" || schools.some((s) => s.id === requested) ? requested : undefined;
  const ownSchool = schools.some((s) => s.id === viewer?.profile.school_id) ? viewer?.profile.school_id : undefined;
  const selected = validRequested ?? ownSchool ?? (schools.length === 1 ? schools[0].id : "all");
  const selectedSchool = schools.find((s) => s.id === selected);

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
  query = selected !== "all" ? query.eq("school_id", selected) : query.in("school_id", schools.map((s) => s.id));
  const { data } = await query;
  const markets = (data ?? []) as Market[];
  const schoolLabels = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));
  const canPropose = !!viewer && (!!viewer.profile.can_propose || viewer.profile.is_admin);

  return (
    <Container>
      <section className="space-y-4">
        <AutoRefresh intervalMs={30_000} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {selectedSchool ? `Live at ${selectedSchool.short_name}` : "Live markets"}
            </h1>
            <Link href="/rooms" className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand">
              Community rooms →
            </Link>
          </div>
          {schools.length > 1 && <SchoolPicker schools={schools} selected={selected} mySchoolId={viewer?.profile.school_id ?? null} />}
        </div>
        <SponsorBanner banner={banner} />
        <PersonalBoard
          saved={viewer?.profile.interests ?? null}
          loggedIn={!!viewer}
          canPropose={canPropose}
          markets={markets}
          schoolLabels={schoolLabels}
          showSchool={selected === "all"}
          serverNow={now}
          feeBps={settings.pool_fee_bps}
          emptyHint="No live markets here right now. New ones drop all the time."
        />
      </section>
    </Container>
  );
}
