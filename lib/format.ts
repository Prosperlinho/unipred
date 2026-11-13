export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatCP(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function compactCP(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-US");
}

export function formatSigned(n: number): string {
  const sign = n > 0.004 ? "+" : n < -0.004 ? "-" : "";
  return `${sign}${formatCP(Math.abs(n))}`;
}

export function formatPct(p: number): string {
  const pct = p * 100;
  if (pct > 0 && pct < 1) return "<1%";
  if (pct > 99 && pct < 100) return ">99%";
  return `${Math.round(pct)}%`;
}

export function formatPrice(p: number): string {
  return p.toFixed(2);
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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDate(t: number): string {
  return new Date(t).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Value for <input type="datetime-local"> in the user's local timezone. */
export function toLocalInputValue(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}
