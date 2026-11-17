/**
 * UniPred "U" mark: a tall lime stroke and a shorter cream stroke joined at the bottom,
 * traced from the brand logo (on a 400×400 grid, cropped to the mark).
 */
export const LOGO_LIME = "#C6F432";
export const LOGO_CREAM = "#F3EFE6";
export const LOGO_BG = "#0B1F16";

export const LOGO_LEFT_PATH = "M120 110 A28 28 0 0 1 176 110 V240 A24 24 0 0 0 200 264 V320 A80 80 0 0 1 120 240 Z";
export const LOGO_RIGHT_PATH = "M224 174 A28 28 0 0 1 280 174 V240 A80 80 0 0 1 200 320 V264 A24 24 0 0 0 224 240 Z";

export function LogoMark({ className, title = "UniPred" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="112 74 176 254" className={className} role="img" aria-label={title}>
      <path d={LOGO_LEFT_PATH} fill={LOGO_LIME} />
      <path d={LOGO_RIGHT_PATH} fill={LOGO_CREAM} />
    </svg>
  );
}

/** Logo on its dark green tile, as on the X profile picture. */
export function LogoTile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="UniPred">
      <rect width="400" height="400" rx="96" fill={LOGO_BG} />
      <path d={LOGO_LEFT_PATH} fill={LOGO_LIME} />
      <path d={LOGO_RIGHT_PATH} fill={LOGO_CREAM} />
    </svg>
  );
}
