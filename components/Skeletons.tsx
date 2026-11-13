export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-card" />
      <div className="h-4 w-72 animate-pulse rounded bg-card" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-2xl border border-line bg-card" />
        ))}
      </div>
    </div>
  );
}
