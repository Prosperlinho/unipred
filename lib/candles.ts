export interface Candle {
  /** YES share of the pot (0..1) at the start, end, highest and lowest point of the period. */
  o: number;
  c: number;
  h: number;
  l: number;
}

/**
 * Turns a market's price history (YES share after each bet) into evenly spaced candles.
 * Each period opens at the previous close, so the chart reads as one continuous line.
 */
export function buildCandles(points: Array<{ t: number; p: number }>, count = 28): Candle[] {
  const pts = points.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.p)).sort((a, b) => a.t - b.t);
  if (pts.length === 0) return Array.from({ length: count }, () => ({ o: 0.5, c: 0.5, h: 0.5, l: 0.5 }));
  const start = pts[0].t;
  const end = Math.max(pts[pts.length - 1].t, start + 1);
  const step = (end - start) / count;

  const candles: Candle[] = [];
  let prev = pts[0].p;
  let idx = 0;
  for (let i = 0; i < count; i++) {
    const bucketEnd = i === count - 1 ? Infinity : start + step * (i + 1);
    const o = prev;
    let h = o;
    let l = o;
    let c = o;
    while (idx < pts.length && pts[idx].t <= bucketEnd) {
      c = pts[idx].p;
      h = Math.max(h, c);
      l = Math.min(l, c);
      idx++;
    }
    candles.push({ o, c, h, l });
    prev = c;
  }
  return candles;
}
