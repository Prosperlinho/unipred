import { Container } from "@/components/Container";
import { Hero } from "@/components/Hero";
import { AutoRefresh } from "@/components/LiveRefresh";
import { MarketFeed } from "@/components/MarketFeed";
import { SchoolPicker } from "@/components/SchoolPicker";
import { getRequestTime } from "@/lib/time";
import { getViewer } from "@/lib/auth";
import { getActiveSchools, getSettings } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Market } from "@/lib/types";

export default async function HomePage(props: PageProps<"/">) {
  if (!isSupabaseConfigured) return null;
  const searchParams = await props.searchParams;
  const [viewer, schools, settings] = await Promise.all([getViewer(), getActiveSchools(), getSettings()]);

  const requested = typeof searchParams.school === "string" ? searchParams.school : undefined;
  const validRequested = requested === "all" || schools.some((s) => s.id === requested) ? requested : undefined;
  const ownSchool = schools.some((s) => s.id === viewer?.profile.school_id) ? viewer?.profile.school_id : undefined;
  // With a single open school, everyone lands on it.
  const selected = validRequested ?? ownSchool ?? (schools.length === 1 ? schools[0].id : "all");
  const selectedSchool = schools.find((s) => s.id === selected);

  const supabase = await createClient();
  let query = supabase
    .from("markets")
    .select("*")
    .in("status", ["open", "resolved", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(120);
  query = selected !== "all" ? query.eq("school_id", selected) : query.in("school_id", schools.map((s) => s.id));
  const { data } = await query;
  const markets = (data ?? []) as Market[];

  const now = getRequestTime();
  const topMarket =
    markets
      .filter((m) => m.status === "open" && new Date(m.closes_at).getTime() > now)
      .sort((a, b) => b.volume_kobo - a.volume_kobo)[0] ?? null;
  const schoolLabels = Object.fromEntries(schools.map((s) => [s.id, s.short_name]));

  return (
    <>
      <Hero
        loggedIn={!!viewer}
        topMarket={topMarket}
        topSchoolLabel={topMarket ? schoolLabels[topMarket.school_id] : undefined}
      />
      <Container className="-mt-8 sm:-mt-10">
        <section id="markets" className="relative z-10 scroll-mt-20 space-y-4">
          <AutoRefresh intervalMs={30_000} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {selectedSchool ? `Markets at ${selectedSchool.short_name}` : "Markets across Nigeria"}
              </h2>
              <p className="text-sm text-muted">
                {selectedSchool ? selectedSchool.name : "Every university on UniPred. Pick yours to narrow it down."}
              </p>
            </div>
            <SchoolPicker schools={schools} selected={selected} mySchoolId={viewer?.profile.school_id ?? null} />
          </div>
          <MarketFeed
            markets={markets}
            schoolLabels={schoolLabels}
            showSchool={selected === "all"}
            serverNow={now}
            feeBps={settings.pool_fee_bps}
            emptyHint={
              selectedSchool
                ? `Nobody has opened a market at ${selectedSchool.short_name} yet. Propose the first one and our team will review it.`
                : "No markets are live yet. Propose one and our team will review it."
            }
          />
        </section>
      </Container>
    </>
  );
}
