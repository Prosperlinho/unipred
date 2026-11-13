import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Portfolio } from "@/components/Portfolio";

export const metadata: Metadata = {
  title: "Portfolio · UniPred",
};

export default function PortfolioPage() {
  return (
    <Container>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Your Portfolio</h1>
        <p className="text-sm text-muted">Track positions, settle resolved markets and test the resolution simulator.</p>
      </div>
      <Portfolio />
    </Container>
  );
}
