import { DEFAULT_PAIR, Pair, stock } from "./catalog";
import { History, IndexSnapshot, Interval, MAX_SKEW_MS, SOURCE } from "./market";
import { nyDate, nyTime } from "./market-calendar";
export class FeedError extends Error {
  constructor(public status: "access_denied" | "quota_exhausted" | "partial" | "unavailable" | "desynchronized", public retryMs = 0) { super(status); }
}
type Obj = Record<string, unknown>;
function object(value: unknown): Obj { if (!value || typeof value !== "object" || Array.isArray(value)) throw new FeedError("partial"); return value as Obj; }
function positive(value: unknown) { const n = typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN; if (!Number.isFinite(n) || n <= 0) throw new FeedError("partial"); return n; }
export function providerError(value: unknown) {
  const item = object(value);
  if (item.status === "error") {
    const code = Number(item.code);
    throw new FeedError(code === 429 ? "quota_exhausted" : [401, 403].includes(code) ? "access_denied" : code >= 500 ? "unavailable" : "partial");
  }
  return item;
}
export function normalizeQuotes(raw: unknown, now: number, pair: Pair = DEFAULT_PAIR): IndexSnapshot {
  const batch = providerError(raw);
  const parse = (symbol: string) => normalizeStockQuote(batch[symbol], symbol, now);
  const base = parse(pair.base), quote = parse(pair.quote);
  if (Math.abs(base.timestamp - quote.timestamp) > MAX_SKEW_MS) throw new FeedError("desynchronized");
  const ratio = base.price / quote.price;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new FeedError("partial");
  return { id: `${base.timestamp}:${base.price}/${quote.timestamp}:${quote.price}`, source: SOURCE, pair, base, quote, ratio, timestamp: Math.min(base.timestamp, quote.timestamp), fetchedAt: now };
}
export function normalizeHistory(raw: unknown, interval: Interval, now: number, pair: Pair = DEFAULT_PAIR): History {
  const batch = providerError(raw);
  const parse = (symbol: string) => normalizeStockHistory(batch[symbol], symbol, interval, now);
  const a = parse(pair.base), b = parse(pair.quote); let unmatched = 0;
  const points = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y).map(timestamp => {
    const x = a.get(timestamp), y = b.get(timestamp);
    const value = x !== undefined && y !== undefined ? x / y : null;
    if (value === null) unmatched++;
    else if (!Number.isFinite(value) || value <= 0) throw new FeedError("partial");
    const label = new Date(timestamp).toLocaleString("en-US", interval === "1day" ? { timeZone: "America/New_York", month: "short", day: "numeric" } : { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    return { timestamp, value, label };
  });
  if (points.filter(p => p.value !== null).length < 2) throw new FeedError("partial");
  return { interval, points, fetchedAt: now, status: "ready", unmatched };
}
export function normalizeStockQuote(raw: unknown, symbol: string, now: number) {
    const q = providerError(raw);
    if (q.symbol !== symbol || q.currency !== "USD" || q.exchange !== stock(symbol)?.exchange || typeof q.is_market_open !== "boolean") throw new FeedError("partial");
    // /quote timestamp is bar-open, NOT quote time. Require last_quote_at, no fallback.
    const timestamp = positive(q.last_quote_at) * 1000;
    if (!Number.isInteger(timestamp / 1000) || timestamp > now + 10_000 || timestamp < Date.UTC(2000, 0, 1)) throw new FeedError("partial");
    return { symbol, currency: "USD" as const, price: positive(q.close), timestamp, marketOpen: q.is_market_open };
}

export function normalizeStockHistory(raw: unknown, symbol: string, interval: Interval, now: number) {
    const series = providerError(raw); const meta = object(series.meta);
    if (meta.symbol !== symbol || meta.currency !== "USD" || meta.interval !== interval || meta.exchange !== stock(symbol)?.exchange || meta.exchange_timezone !== "America/New_York" || !Array.isArray(series.values) || !series.values.length) throw new FeedError("partial");
    const map = new Map<number, number>();
    for (const value of series.values) {
      const point = object(value); const datetime = String(point.datetime);
      let timestamp: number;
      if (interval === "1day") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datetime) || new Date(datetime).toISOString().slice(0, 10) !== datetime) throw new FeedError("partial");
        // Daily timezone parameter is ignored: exchange session date, NOT UTC midnight.
        timestamp = nyTime(datetime, 0);
        if (datetime > nyDate(now)) throw new FeedError("partial");
        if (datetime === nyDate(now)) continue; // completed sessions only
      } else {
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(datetime)) throw new FeedError("partial");
        timestamp = Date.parse(datetime.replace(" ", "T") + "Z"); // requested timezone=UTC
        if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 19).replace("T", " ") !== datetime || timestamp % 300_000 !== 0 || timestamp > now) throw new FeedError("partial");
        if (timestamp + 300_000 > now) continue; // no unfinished bar
      }
      if (!Number.isFinite(timestamp) || timestamp < Date.UTC(2000, 0, 1) || map.has(timestamp)) throw new FeedError("partial");
      map.set(timestamp, positive(point.close));
    }
    return map;
}
