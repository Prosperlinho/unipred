import { Container } from "@/components/Container";
import { Hero } from "@/components/Hero";
import { MarketFeed } from "@/components/MarketFeed";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Container className="-mt-8 sm:-mt-10">
        <section id="markets" className="relative z-10 scroll-mt-20">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">What&apos;s happening on campus?</h2>
            <p className="text-sm text-muted">Back your read on elections, results, matches and gist with Campus Points.</p>
          </div>
          <MarketFeed />
        </section>
      </Container>
    </>
  );
}
