/**
 * Lightweight animated backdrop for the hero: drifting YES/NO probability
 * lines plus two soft glows. Pure SVG/CSS (a few KB), no video download.
 * Paths are generated deterministically so server and client markup match.
 */

const W = 1400;
const H = 700;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function series(seed: number, start: number, steps: number, volatility: number): number[] {
  const rand = rng(seed);
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < steps; i++) {
    // Random walk with a gentle pull toward 50% so lines stay on screen.
    p += (rand() - 0.5) * volatility + (0.5 - p) * 0.05;
    p = Math.min(0.88, Math.max(0.12, p));
    out.push(p);
  }
  return out;
}

function toPath(values: number[]): string {
  const top = 70;
  const bottom = H - 70;
  const step = (W + 80) / (values.length - 1);
  return values
    .map((p, i) => {
      const x = -40 + i * step;
      const y = top + (1 - p) * (bottom - top);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const yes = series(7, 0.42, 44, 0.16);
const YES_PATH = toPath(yes);
const NO_PATH = toPath(yes.map((p) => 1 - p));
const YES_AREA = `${YES_PATH} L${W + 40} ${H} L-40 ${H} Z`;
const TEAL_PATH = toPath(series(19, 0.62, 36, 0.12));
const GOLD_PATH = toPath(series(31, 0.3, 30, 0.1));

const LINES = [
  { d: TEAL_PATH, stroke: "var(--color-brand-teal)", width: 1.5, opacity: 0.3, delay: "0.2s" },
  { d: GOLD_PATH, stroke: "var(--color-brand-gold)", width: 1.2, opacity: 0.22, delay: "0.4s" },
  { d: NO_PATH, stroke: "var(--color-no)", width: 2, opacity: 0.4, delay: "0.1s" },
  { d: YES_PATH, stroke: "var(--color-yes)", width: 2.5, opacity: 0.6, delay: "0s" },
];

export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      {/* Soft glows (radial gradients are far cheaper than CSS blur on low-end phones) */}
      <div
        className="absolute -right-32 -top-40 size-[640px] animate-glow rounded-full"
        style={{ background: "radial-gradient(circle, rgba(59,164,171,0.35) 0%, transparent 62%)" }}
      />
      <div
        className="absolute -bottom-48 right-1/4 size-[560px] animate-glow rounded-full [animation-delay:-4s]"
        style={{ background: "radial-gradient(circle, rgba(226,176,92,0.22) 0%, transparent 62%)" }}
      />

      <div className="absolute inset-y-0 left-0 w-[112%] animate-drift">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
          fill="none"
        >
          <defs>
            <linearGradient id="hero-yes-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-yes)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-yes)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1="0"
              x2={W}
              y1={70 + g * (H - 140)}
              y2={70 + g * (H - 140)}
              stroke="white"
              strokeOpacity={g === 0.5 ? 0.08 : 0.04}
              strokeDasharray={g === 0.5 ? "6 8" : "2 10"}
            />
          ))}

          <path d={YES_AREA} fill="url(#hero-yes-fill)" className="animate-fade-in [animation-duration:2.4s]" />

          {LINES.map((l) => (
            <path
              key={l.d}
              d={l.d}
              stroke={l.stroke}
              strokeWidth={l.width}
              strokeOpacity={l.opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              className="animate-line-draw"
              style={{ animationDelay: l.delay }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
