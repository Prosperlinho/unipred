"use client";

import { Plus, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/useNow";
import { CATEGORIES, SORT_MODES, type Category, type Market, type SortMode } from "@/lib/types";
import { MarketCard } from "./MarketCard";

type Filter = "All" | Category;
const FILTERS: Filter[] = ["All", ...CATEGORIES];

interface Props {
  markets: Market[];
  schoolLabels: Record<string, string>;
  showSchool: boolean;
  serverNow: number;
  emptyHint: string;
}

function trendingScore(m: Market, now: number): number {
  const ageHours = Math.max(1, (now - new Date(m.approved_at ?? m.created_at).getTime()) / 3_600_000);
  return (m.volume_kobo / 100 + m.traders * 200) / Math.pow(ageHours, 0.35);
}

export function MarketFeed({ markets, schoolLabels, showSchool, serverNow, emptyHint }: Props) {
  const now = useNow(serverNow);
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<SortMode>("Trending");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = markets.filter(
      (m) =>
        (filter === "All" || m.category === filter) &&
        (!q ||
          m.question.toLowerCase().includes(q) ||
          (schoolLabels[m.school_id] ?? "").toLowerCase().includes(q)),
    );
    const isLive = (m: Market) => m.status === "open" && new Date(m.closes_at).getTime() > now;
    return [...list].sort((a, b) => {
      const liveDiff = Number(isLive(b)) - Number(isLive(a));
      if (liveDiff !== 0) return liveDiff;
      if (sort === "Closing Soon") return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
      if (sort === "Newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return trendingScore(b, now) - trendingScore(a, now);
    });
  }, [markets, filter, sort, query, now, schoolLabels]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets..."
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
            aria-pressed={filter === f}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f ? "bg-white text-black" : "border border-line bg-card text-muted hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {visible.length} market{visible.length === 1 ? "" : "s"}
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-14 text-center">
          <SearchX className="size-8 text-muted" />
          <p className="font-medium text-white">No markets here yet</p>
          <p className="max-w-sm text-sm text-muted">{emptyHint}</p>
          <Link
            href="/propose"
            className="mt-2 inline-flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
          >
            <Plus className="size-4" strokeWidth={3} /> Propose a market
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <MarketCard key={m.id} market={m} now={now} schoolLabel={showSchool ? schoolLabels[m.school_id] : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
