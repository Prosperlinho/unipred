import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-white">UniPred</span> · 18+ only · Predict responsibly and only stake what
          you can afford to lose.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/sponsors" className="hover:text-white">
            Sponsors
          </Link>
          <Link href="/rules" className="hover:text-white">
            House Rules
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
