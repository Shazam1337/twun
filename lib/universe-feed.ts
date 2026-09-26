import { CatalogStatus, Pair, pairId } from "./catalog";
import { demoIndexAllowed, FeedStatus, feedMessages, History, indexFresh, Interval, MarketFeed, MAX_SKEW_MS, Quote, SOURCE } from "./market";
import { marketSession } from "./market-calendar";
export type QuoteCache = { value?: Quote; status: FeedStatus; checkedAt: number; nextAt: number };
export type StockHistory = { values: [number, number][]; status: FeedStatus; checkedAt: number; nextAt: number };
export type UniverseCache = { quotes: Record<string, QuoteCache>; histories: Record<string, StockHistory>; catalog: CatalogStatus; logosChecked: Record<string, number> };
export type Bundle = { market: MarketFeed; quotes: UniverseCache["quotes"]; catalog: CatalogStatus; budget: { used: number; limit: number; minuteUsed: number; minuteLimit: number; retryAt: number; day: string }; serverTime: number };
export function pairFeed(pair: Pair, quotes: UniverseCache["quotes"], now: number, configured = true): MarketFeed {
  const session = marketSession(now), a = quotes[pair.base], b = quotes[pair.quote];
  let status: FeedStatus = !configured ? "not_configured" : !a || !b ? "unavailable" : a.status !== "ready" ? a.status : b.status;
  const base = a?.value, quote = b?.value;
  const ratio = base && quote ? base.price / quote.price : NaN;
  const snapshot = base && quote && Number.isFinite(ratio) && ratio > 0 ? { pair, id: `${pairId(pair)}:${base.timestamp}:${base.price}/${quote.timestamp}:${quote.price}`, source: SOURCE as typeof SOURCE, base, quote, ratio, timestamp: Math.min(base.timestamp,quote.timestamp), fetchedAt: Math.min(a.checkedAt,b.checkedAt) } : null;
  if (status === "ready" && (!snapshot || Math.abs(base!.timestamp - quote!.timestamp) > MAX_SKEW_MS)) status = "desynchronized";
  if (status === "ready" && session.state === "open" && !indexFresh(snapshot!, now)) status = "stale";
  // Do not present a mixed or invalid snapshot as a usable pair. Last account marks are stored separately.
  return { pair, status, message: feedMessages[status], snapshot: status === "ready" ? snapshot : null, session, serverTime: now, retryAt: Math.max(a?.nextAt ?? 0,b?.nextAt ?? 0), canTrade: status === "ready" && demoIndexAllowed(snapshot,session,now), histories: {"5min":null,"1day":null} };
}
export function joinHistory(a: StockHistory | undefined, b: StockHistory | undefined, interval: Interval): History | null {
  if (!a || !b) return null;
  const av = new Map(a.values), bv = new Map(b.values); let unmatched = 0;
  const points = [...new Set([...av.keys(),...bv.keys()])].sort((x,y)=>x-y).map(timestamp => {
    const x=av.get(timestamp), y=bv.get(timestamp), ratio=x && y ? x/y : NaN;
    const value=Number.isFinite(ratio)&&ratio>0?ratio:null;
    if (value === null) unmatched++;
    return {timestamp,value,label:new Date(timestamp).toLocaleString("en-US",{timeZone:interval==="1day"?"America/New_York":"UTC",month:"short",day:"numeric"})};
  });
  const status=a.status!=="ready"?a.status:b.status;
  return { interval, points, unmatched, fetchedAt:Math.min(a.checkedAt,b.checkedAt), status:status==="ready"&&points.filter(p=>p.value!==null).length<2?"partial":status };
}
