export interface Candle {
  /** YES share of the pot (0..1) at the start, end, highest and lowest point of the period. */
  o: number;
  c: number;
  h: number;
  l: number;
}

/**
 * Candles spaced by betting activity rather than time: each candle covers an equal
 * share of the bets, so bursts of betting stay readable and quiet stretches don't
 * flatten the chart. Each candle opens at the previous close.
 */
export function buildTradeCandles(points: Array<{ t: number; p: number }>, maxCount = 28): Candle[] {
  const pts = points.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.p)).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return buildCandles(pts, maxCount);
  const moves = pts.slice(1);
  const count = Math.min(maxCount, Math.max(6, moves.length));
  const candles: Candle[] = [];
  let prev = pts[0].p;
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * moves.length) / count);
    const to = Math.floor(((i + 1) * moves.length) / count);
    const o = prev;
    let h = o;
    let l = o;
    let c = o;
    for (const m of moves.slice(from, to)) {
      c = m.p;
      h = Math.max(h, c);
      l = Math.min(l, c);
    }
    candles.push({ o, c, h, l });
    prev = c;
  }
  return candles;
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
