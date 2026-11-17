import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function HeroActions({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <a
        href="#markets"
        className="group flex items-center justify-center gap-3 rounded-full bg-brand px-8 py-4 font-semibold text-black transition hover:brightness-110"
      >
        Start Predicting
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
      </a>
      <Link
        href={loggedIn ? "/propose" : "/signup"}
        className="group flex items-center justify-center gap-3 rounded-full border border-white/40 bg-transparent px-8 py-4 font-medium text-white transition-colors hover:border-white hover:bg-white/5"
      >
        {loggedIn ? "Propose a Market" : "Create Free Account"}
        <ArrowRight className="size-5 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
      </Link>
    </div>
  );
}
