import type { PricePoint } from "@/lib/types";

interface Props {
  points: PricePoint[];
  height?: number;
}

/** Dependency-free SVG probability chart (YES probability over time). */
export function Sparkline({ points, height = 96 }: Props) {
  const data = points.length > 1 ? points : [...points, ...points];
  if (data.length === 0) return null;

  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const W = 300;
  const H = 100;
  const pad = 4;

  const coords = data.map((pt, i) => {
    const x = t1 === t0 ? (i / (data.length - 1)) * W : ((pt.t - t0) / span) * W;
    const y = pad + (1 - pt.p) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = data[data.length - 1].p;
  const up = last >= data[0].p;
  const stroke = up ? "var(--color-yes)" : "var(--color-no)";
  const [lx, ly] = coords[coords.length - 1];

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={pad + (1 - g) * (H - pad * 2)}
            y2={pad + (1 - g) * (H - pad * 2)}
            stroke="var(--color-line)"
            strokeDasharray={g === 0.5 ? "4 4" : "2 6"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill="url(#spark-fill)" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-bg"
        style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%`, background: stroke }}
      />
      <span className="absolute right-0 top-0 text-[10px] text-muted">100%</span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-muted">50%</span>
      <span className="absolute bottom-0 right-0 text-[10px] text-muted">0%</span>
    </div>
  );
}
