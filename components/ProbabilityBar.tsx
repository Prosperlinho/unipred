import { formatPct } from "@/lib/format";

interface Props {
  probYes: number;
  size?: "sm" | "lg";
}

export function ProbabilityBar({ probYes, size = "sm" }: Props) {
  const yes = Math.min(1, Math.max(0, probYes));
  const no = 1 - yes;
  const height = size === "lg" ? "h-3" : "h-2";
  const text = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div>
      <div className={`mb-1.5 flex items-center justify-between font-semibold tabular-nums ${text}`}>
        <span className="text-yes">YES {formatPct(yes)}</span>
        <span className="text-no">NO {formatPct(no)}</span>
      </div>
      <div
        className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-line ${height}`}
        role="img"
        aria-label={`YES ${formatPct(yes)}, NO ${formatPct(no)}`}
      >
        <div
          className="rounded-l-full bg-yes transition-[width] duration-500 ease-out"
          style={{ width: `${yes * 100}%` }}
        />
        <div
          className="rounded-r-full bg-no transition-[width] duration-500 ease-out"
          style={{ width: `${no * 100}%` }}
        />
      </div>
    </div>
  );
}
