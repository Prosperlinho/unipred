export function FeedSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[214px] animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </div>
  );
}

export function PortfolioSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-line bg-card" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </div>
  );
}
