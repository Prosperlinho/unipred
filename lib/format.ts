/** ₦ amount from kobo. Whole-naira amounts drop the decimals. */
export function formatNaira(kobo: number): string {
  const naira = Math.round(kobo) / 100;
  const whole = Number.isInteger(naira);
  return `₦${Math.abs(naira).toLocaleString("en-NG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`.replace("₦", naira < 0 ? "-₦" : "₦");
}

export function formatSignedNaira(kobo: number): string {
  if (Math.abs(kobo) < 1) return formatNaira(0);
  return `${kobo > 0 ? "+" : "-"}${formatNaira(Math.abs(kobo))}`;
}

export function compactNaira(kobo: number): string {
  const naira = kobo / 100;
  const abs = Math.abs(naira);
  if (abs >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₦${(naira / 1_000).toFixed(1)}k`;
  return `₦${Math.round(naira).toLocaleString("en-NG")}`;
}

export function formatShares(n: number): string {
  return n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

export function formatPct(p: number): string {
  const pct = p * 100;
  if (pct > 0 && pct < 1) return "<1%";
  if (pct > 99 && pct < 100) return ">99%";
  return `${Math.round(pct)}%`;
}

export function formatSignedPct(r: number): string {
  const v = Math.round(r * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function timeLeft(closesAt: number, now: number): string {
  const ms = closesAt - now;
  if (ms <= 0) return "Closed";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${m}m left`;
  if (mins > 0) return `${m}m left`;
  return "<1m left";
}

export function timeAgo(t: number, now: number): string {
  const secs = Math.max(0, Math.floor((now - t) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDate(t: number | string): string {
  return new Date(t).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 _.]/g, "").split(/[ _.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Value for <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInputValue(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
