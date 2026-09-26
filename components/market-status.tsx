"use client";
import { RefreshCw } from "lucide-react";
import { useMarket } from "./market-store";
import { useDemo } from "./demo-store";
import { money } from "@/lib/perps";
export function quoteTime(timestamp?: number) { return timestamp ? new Date(timestamp).toLocaleString("en-GB", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC" : "—"; }
export function MarketStatus() {
  const { feed, canTrade, loading, refresh, now, pair } = useMarket();
  const { state } = useDemo(); const q = feed?.snapshot;
  const sessionClosed = feed && (feed.session.state !== "open" || now() >= feed.session.closesAt || (q && (!q.base.marketOpen || !q.quote.marketOpen)));
  const title = loading ? "Loading market data…" : !feed ? "Market data connection unavailable" : feed.status !== "ready" ? feed.message : !canTrade ? "Market data stale — calculations paused" : sessionClosed ? "Market closed · Demo trading at last available prices" : "Real market data · Simulated execution";
  return <section aria-label="Market data status" className="border-b border-[var(--line)] bg-[var(--paper)] p-4">
    <div className="flex items-start justify-between gap-3"><div><p role="status" className="text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-[#686057]">Twelve Data · REST snapshots, not a tick stream · regular US session</p></div><button aria-label="Refresh market data" title="Recheck shared server cache" onClick={() => void refresh()} className="border border-[var(--line)] p-2"><RefreshCw size={12}/></button></div>
    <div className="mt-4 grid grid-cols-2 gap-3">{([[pair.base, q?.base], [pair.quote, q?.quote]] as const).map(([label, quote]) => <div key={label}><p className="text-[11px] font-semibold">{label}</p><p className="mt-1 mono text-lg font-medium">{quote ? `$${money(quote.price)}` : "—"} <span className="text-[10px] text-[#686057]">USD</span></p><p className="mt-1 mono text-[9px] text-[#686057]">{quoteTime(quote?.timestamp)}</p></div>)}</div>
    <p className="mt-3 text-[10px] leading-relaxed text-[#686057]">{sessionClosed ? (feed?.session.state === "unknown" ? "Session calendar unavailable" : "Market closed") : feed?.session.label ?? "Session status pending"} · America/New_York. Underlying stock-price index, not xStocks or a quoted perpetual market.</p>
    {feed?.status === "not_configured" && <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] leading-relaxed">Add <code>TWELVE_DATA_API_KEY</code> to server <code>.env.local</code> and restart. No fallback prices are supplied.</p>}
    {!canTrade && <p className="mt-2 text-[10px] leading-relaxed text-[#686057]">Open / close, funding and liquidation are paused. {state.pairMarks[`${pair.base}/${pair.quote}`]?.acceptedIndex ? `Position valuation frozen at ${quoteTime(state.pairMarks[`${pair.base}/${pair.quote}`].acceptedIndex?.timestamp)}.` : "Waiting for the first valid index."}</p>}
  </section>;
}
