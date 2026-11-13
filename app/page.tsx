import { MarketFeed } from "@/components/MarketFeed";

export default function HomePage() {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">What&apos;s happening on campus?</h1>
        <p className="text-sm text-muted">Back your read on elections, results, matches and gist with Campus Points.</p>
      </div>
      <MarketFeed />
    </>
  );
}
