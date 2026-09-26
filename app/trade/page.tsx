"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Layers3 } from "lucide-react";
import { stock } from "@/lib/catalog";
import { MarketSelector } from "@/components/market-selector";
import { PairChart } from "@/components/pair-chart";
import { PositionForm } from "@/components/position-form";
import { TradeHistory } from "@/components/trade-history";
import { PerpsPositions } from "@/components/perps-positions";
import { DemoMarket } from "@/components/demo-market";
import { PerpsNotice } from "@/components/perps-notice";
import { useDemo } from "@/components/demo-store";
import { useMarket } from "@/components/market-store";
import { OdadoFeedStatus, OdadoModel } from "@/components/odado-market";
import { quoteTime } from "@/components/market-status";
import { ChartRange, money, ranges } from "@/lib/perps";
import { historySeries, historyChange } from "@/lib/market";

export default function TradePage() {
  const { state } = useDemo();
  const { feed, pair, setInterval } = useMarket();
  const [range, setRange] = useState<ChartRange>("30D");
  const [tab, setTab] = useState<"positions" | "history">("positions");
  useEffect(()=>setInterval(range==="1D"||range==="7D"?"5min":"1day"),[range,setInterval]);
  const ratio = feed?.snapshot?.ratio;
  const change = historyChange(historySeries(feed, range));
  return <main>
    <div className="odado-workspace">
      <PerpsNotice dismissible/>
      <div className="odado-layout">
        <div className="odado-main-column">
          <section className="odado-panel odado-chart-panel" aria-label={`${pair.base}/${pair.quote} market`}>
            <div className="odado-market-heading">
              <MarketSelector/>
              <div className="odado-index"><p className="odado-mini-label">Index ratio</p><div><span data-testid="current-ratio" className="mono odado-ratio">{ratio?.toFixed(4) ?? "—"}</span><span className={`odado-change ${change === null ? "" : change >= 0 ? "is-positive" : "is-negative"}`}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}<small>{range}</small></span></div></div>
              <div className="odado-stock-prices">{([[stock(pair.base)!.name, pair.base, feed?.snapshot?.base], [stock(pair.quote)!.name, pair.quote, feed?.snapshot?.quote]] as const).map(([name, symbol, quote]) => <div key={symbol} title={`${name} · ${quoteTime(quote?.timestamp)}`}><p>{name}<span>{symbol}</span></p><span className="mono">{quote ? `$${money(quote.price)}` : "—"}</span></div>)}</div>
            </div>
            <OdadoFeedStatus alertsOnly/>
            <div className="odado-chart-toolbar"><span><span className="odado-line-swatch"/>Price ratio <small>USD / USD</small></span><div className="odado-periods" aria-label="Chart period">{ranges.map(r => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}</div></div>
            <PairChart range={range}/>
            <OdadoFeedStatus/>
          </section>
          <section className="odado-panel odado-activity" aria-label="Demo account activity">
            <div className="odado-activity-top"><div role="tablist" aria-label="Account views">{(["positions", "history"] as const).map((name, i) => <button key={name} role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "positions" : e.key === "End" ? "history" : i === 0 ? "history" : "positions"; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{name === "positions" ? "Positions" : "History"}<span>{name === "positions" ? state.positions.length : state.history.length}</span></button>)}</div><span className="odado-local-label"><Layers3 size={14}/>Demo account · Saved locally</span></div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>{tab === "positions" ? <PerpsPositions compact/> : <TradeHistory compact/>}</div>
          </section>
        </div>
        <div className="odado-order-column"><PositionForm/><OdadoModel/><details className="odado-panel odado-disclosure odado-demo-controls"><summary>Demo controls<ChevronDown size={16}/></summary><DemoMarket/></details></div>
      </div>
      <footer className="odado-footer"><span>One ratio. Two perspectives.</span><span>Simulated USDC · No signatures or transactions</span></footer>
    </div>
  </main>;
}
