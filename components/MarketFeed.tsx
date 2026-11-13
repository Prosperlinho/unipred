"use client";

import { Search, SearchX, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useMarkets } from "@/context/MarketContext";
import { useUI } from "@/context/UIContext";
import { useNow } from "@/lib/useNow";
import { CATEGORIES, SORT_MODES, type Category, type Market, type Outcome, type SortMode } from "@/lib/types";
import { MarketCard } from "./MarketCard";
import { FeedSkeleton } from "./Skeletons";

type Filter = "All" | Category;
const FILTERS: Filter[] = ["All", ...CATEGORIES];

function trendingScore(m: Market, now: number): number {
  const ageHours = Math.max(1, (now - m.createdAt) / 3_600_000);
  return (m.volume + m.comments.length * 400 + m.traders * 20) / Math.pow(ageHours, 0.35);
}

export function MarketFeed() {
  const { hydrated, markets } = useMarkets();
  const { openMarket } = useUI();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<SortMode>("Trending");
  const [query, setQuery] = useState("");

  const onOpen = useCallback((id: string, side?: Outcome) => openMarket(id, { side }), [openMarket]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = markets.filter(
      (m) =>
        (filter === "All" || m.category === filter) &&
        (!q || m.question.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)),
    );
    const isLive = (m: Market) => !m.resolution && m.closesAt > now;

    return [...list].sort((a, b) => {
      // Live markets always come before closed / resolved ones.
      const liveDiff = Number(isLive(b)) - Number(isLive(a));
      if (liveDiff !== 0) return liveDiff;
      if (sort === "Closing Soon") return a.closesAt - b.closesAt;
      if (sort === "Newest") return b.createdAt - a.createdAt;
      return trendingScore(b, now) - trendingScore(a, now);
    });
  }, [markets, filter, sort, query, now]);

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campus markets..."
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none"
            aria-label="Search markets"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? "bg-white text-black"
                  : "border border-line bg-card text-muted hover:text-white"
              }`}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {hydrated ? `${visible.length} market${visible.length === 1 ? "" : "s"}` : "Loading..."}
          </p>
          <div className="flex rounded-lg border border-line bg-card p-0.5" role="tablist" aria-label="Sort markets">
            {SORT_MODES.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={sort === s}
                onClick={() => setSort(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  sort === s ? "bg-card-2 text-white" : "text-muted hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!hydrated ? (
        <FeedSkeleton />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-14 text-center">
          <SearchX className="size-8 text-muted" />
          <p className="font-medium text-white">No markets found</p>
          <p className="text-sm text-muted">Try another category or search term, or create one yourself.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <MarketCard key={m.id} market={m} now={now} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
