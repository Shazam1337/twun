import { Pair } from "./catalog";
import { marketSession } from "./market-calendar";
/** Public feed contract. No credentials or provider network calls in this module. */
export const SOURCE = "Twelve Data / US equities";
export const MAX_AGE_MS = 5 * 60_000;
export const MAX_SKEW_MS = 60_000;
export type Interval = "5min" | "1day";
export type FeedStatus = "ready" | "not_configured" | "access_denied" | "quota_exhausted" | "partial" | "unavailable" | "stale" | "desynchronized";
export type Quote = { symbol: string; price: number; currency: "USD"; timestamp: number; marketOpen: boolean };
export type IndexSnapshot = { id: string; base: Quote; quote: Quote; pair: Pair; ratio: number; timestamp: number; fetchedAt: number; source: typeof SOURCE };
export type HistoryPoint = { timestamp: number; value: number | null; label: string };
export type History = { interval: Interval; points: HistoryPoint[]; fetchedAt: number; status: FeedStatus; unmatched: number };
export type Session = { state: "open" | "closed" | "unknown"; date: string; closesAt: number; label: string };
export type MarketFeed = { pair?: Pair; status: FeedStatus; message: string; snapshot: IndexSnapshot | null; session: Session; histories: Record<Interval, History | null>; serverTime: number; retryAt: number; canTrade: boolean };
export const feedMessages: Record<FeedStatus, string> = {
  ready: "Real market data · Simulated execution", not_configured: "Market data not configured",
  access_denied: "Market data access denied — check the server key and entitlements",
  quota_exhausted: "Market data quota exhausted — updates paused", partial: "Incomplete or invalid provider response — calculations paused",
  unavailable: "Market data service unavailable — calculations paused", stale: "Market data stale — calculations paused",
  desynchronized: "Quote timestamps do not match — calculations paused",
};
export function indexFresh(s: IndexSnapshot, now: number) {
  return [s.base, s.quote].every(q => Number.isFinite(q.price) && q.price > 0 && Number.isFinite(q.timestamp) && q.timestamp <= now + 10_000 && now - q.timestamp <= MAX_AGE_MS) &&
    Math.abs(s.base.timestamp - s.quote.timestamp) <= MAX_SKEW_MS && Number.isFinite(s.ratio) && s.ratio > 0;
}
/** Local demo only: quote age is waived for a known scheduled closure, never validation. */
export function demoIndexAllowed(s: IndexSnapshot | null, session: Session, now: number) {
  if (!s || session.state === "unknown" || marketSession(now).state !== session.state) return false;
  if (s.base.symbol !== s.pair.base || s.quote.symbol !== s.pair.quote || s.pair.base === s.pair.quote) return false;
  if (![s.base,s.quote].every(q => q.currency === "USD" && Number.isFinite(q.price) && q.price > 0 && Number.isFinite(q.timestamp) && q.timestamp >= Date.UTC(2000,0,1) && q.timestamp <= now + 10000)) return false;
  const ratio=s.base.price/s.quote.price;
  if (!Number.isFinite(s.ratio) || s.ratio <= 0 || Math.abs(s.ratio-ratio)>Math.abs(ratio)*1e-12 || Math.abs(s.base.timestamp-s.quote.timestamp)>MAX_SKEW_MS) return false;
  return session.state === "closed" || (now < session.closesAt && s.base.marketOpen && s.quote.marketOpen && indexFresh(s,now));
}
export function tradeAllowed(feed: MarketFeed | null, now: number) {
  return !!feed && feed.status === "ready" && feed.canTrade && demoIndexAllowed(feed.snapshot,feed.session,now) &&
    Number.isFinite(feed.serverTime) && feed.serverTime <= now+10000 && now-feed.serverTime < MAX_AGE_MS;
}
export function historySeries(feed: MarketFeed | null, range: string) {
  const history = feed?.histories[range === "1D" || range === "7D" ? "5min" : "1day"];
  const points = history?.points ?? [];
  const end = points.at(-1)?.timestamp ?? 0;
  const days = ({ "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 } as Record<string, number>)[range] ?? 30;
  return points.filter(p => p.timestamp >= end - days * 86400000);
}
export function historyChange(points: HistoryPoint[]) {
  const valid = points.filter(p => p.value !== null);
  return valid.length > 1 ? (valid.at(-1)!.value! / valid[0].value! - 1) * 100 : null;
}
