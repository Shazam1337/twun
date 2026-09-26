"use client";
import { ChevronDown, CircleHelp, RefreshCw, TriangleAlert } from "lucide-react";
import { useMarket } from "./market-store";
import { useDemo } from "./demo-store";
import { quoteTime } from "./market-status";
export function OdadoFeedStatus({ alertsOnly = false }: { alertsOnly?: boolean }) {
  const { feed, canTrade, loading, refresh, now, pair } = useMarket();
  const { state } = useDemo();
  const quote = feed?.snapshot;
  const closed = feed?.session.state === "closed";
  const message = loading ? "Loading market data…" : !feed ? "Market data connection unavailable" : feed.status !== "ready" ? feed.message : !canTrade ? "Market data stale — calculations paused" : "";
  if (alertsOnly) return message ? <div role="status" className="odado-feed-alert"><TriangleAlert size={17}/><div><strong>{message}</strong>{!loading && <p>This pair: opening, closing and liquidation are paused.{state.pairMarks[`${pair.base}/${pair.quote}`]?.acceptedIndex ? ` Valuation frozen at ${quoteTime(state.pairMarks[`${pair.base}/${pair.quote}`].acceptedIndex?.timestamp)}.` : ""}{feed?.status === "not_configured" ? " Add TWELVE_DATA_API_KEY to server .env.local and restart." : ""}</p>}</div></div> : null;
  return <section aria-label="Market data status" className="odado-sourcebar"><span className="odado-source"><span className={canTrade ? "odado-status-dot" : "odado-status-dot is-muted"}/>Twelve Data · {pair.base}/{pair.quote} <span className="odado-source-divider">/</span> {loading ? "Loading" : closed && canTrade ? "Market closed · Demo trading at last available prices" : canTrade ? "Market open" : "Updates paused"}</span><div><time className="mono" title={`${pair.base}: ${quoteTime(quote?.base.timestamp)} · ${pair.quote}: ${quoteTime(quote?.quote.timestamp)}`}>{quoteTime(quote?.timestamp)}</time><button aria-label="Refresh market data" title="Recheck shared cache · REST quotes every 120s" onClick={() => void refresh()}><RefreshCw size={14}/></button></div></section>;
}
export function OdadoModel() {
  return <details className="odado-panel odado-disclosure"><summary><span><CircleHelp size={16}/>About this market</span><ChevronDown size={16}/></summary><div className="odado-model-copy"><p>A synthetic Odado contract on the first stock’s USD price ÷ the second stock’s USD price. No stock ownership or tokenization. The stock-price index is used as the demo mark; it is not an xStocks quote or an existing perpetual market.</p><dl><div><dt>Maintenance margin</dt><dd>5% of entry notional</dd></div><div><dt>Model funding / 8h</dt><dd>0.01% · Long pays</dd></div><div><dt>Entry / exit fee</dt><dd>0.05% each</dd></div></dl><p>Gross PnL = direction × notional × (current ratio / entry ratio − 1). Fees and funding are separate.</p><p>Periodic REST snapshots, not ticks. Quotes must be synchronized within 60 seconds. During the regular session they must also be within 5 minutes. Outside the session, local demo orders use the last valid prices. Model funding is paused, with no overnight accrual or catch-up. Reopening can trigger gap liquidation.</p><p>History uses matched, unadjusted closes. Splits can cause jumps; percentage change uses the first and last available closes.</p><a href="/perps-model.md" target="_blank" rel="noreferrer">Read the complete model ↗</a></div></details>;
}
