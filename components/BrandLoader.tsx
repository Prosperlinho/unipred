import { LOGO_CREAM, LOGO_LEFT_PATH, LOGO_LIME, LOGO_RIGHT_PATH } from "./Logo";

/**
 * UniPred's loading animation: the "U" fills up stroke by stroke (lime first, then cream),
 * glows, and starts again. Pass `progress` (0 to 1) instead to show a still, partly filled
 * logo, e.g. while the user is pulling down to refresh.
 */
export function BrandLoader({ size = 44, progress, className = "", label = "Loading" }: { size?: number; progress?: number; className?: string; label?: string }) {
  const still = progress !== undefined;
  const p = Math.max(0, Math.min(1, progress ?? 0));
  // While pulling: left stroke fills over the first 60%, right stroke over the rest.
  const left = still ? Math.min(1, p / 0.6) : undefined;
  const right = still ? Math.max(0, (p - 0.4) / 0.6) : undefined;

  return (
    <span role="status" aria-label={label} className={`inline-flex items-center justify-center ${className}`}>
      <svg viewBox="112 74 176 254" width={size * 0.69} height={size} className={still ? "" : "unipred-loader-glow"} aria-hidden>
        <defs>
          <clipPath id="ul-left">
            <path d={LOGO_LEFT_PATH} />
          </clipPath>
          <clipPath id="ul-right">
            <path d={LOGO_RIGHT_PATH} />
          </clipPath>
        </defs>
        {/* faint outline of the full mark */}
        <path d={LOGO_LEFT_PATH} fill={LOGO_LIME} opacity={0.18} />
        <path d={LOGO_RIGHT_PATH} fill={LOGO_CREAM} opacity={0.18} />
        {/* rising fills */}
        <g clipPath="url(#ul-left)">
          <rect
            x="112"
            y="74"
            width="176"
            height="254"
            fill={LOGO_LIME}
            className={still ? "" : "unipred-loader-left"}
            style={still ? { transform: `scaleY(${left})`, transformOrigin: "50% 100%", transformBox: "fill-box" } : undefined}
          />
        </g>
        <g clipPath="url(#ul-right)">
          <rect
            x="112"
            y="74"
            width="176"
            height="254"
            fill={LOGO_CREAM}
            className={still ? "" : "unipred-loader-right"}
            style={still ? { transform: `scaleY(${right})`, transformOrigin: "50% 100%", transformBox: "fill-box" } : undefined}
          />
        </g>
      </svg>
    </span>
  );
}
