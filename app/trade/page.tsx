"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Layers3 } from "lucide-react";
import { stock } from "@/lib/catalog";
import { MarketSelector } from "@/components/market-selector";
import { PairChart } from "@/components/pair-chart";
import {PairComparison} from "@/components/pair-comparison";
import { PositionForm } from "@/components/position-form";
import { PairNews } from "@/components/pair-news";
import { TradeHistory } from "@/components/trade-history";
import { PerpsPositions } from "@/components/perps-positions";
import { DemoMarket } from "@/components/demo-market";
import { PerpsNotice } from "@/components/perps-notice";
import { useDemo } from "@/components/demo-store";
import { useMarket } from "@/components/market-store";
import { OdadoFeedStatus, OdadoModel } from "@/components/odado-market";
import { quoteTime } from "@/components/market-status";
import { money } from "@/lib/perps";

export default function TradePage() {
  const { state } = useDemo();
  const { feed, pair } = useMarket();
  const [change,setChange]=useState<number|null>(null);
  const [tab, setTab] = useState<"positions" | "history">("positions");
  const [compare,setCompare]=useState(false);
  const ratio = feed?.snapshot?.ratio;
  return <main>
    <div className="odado-workspace">
      <PerpsNotice dismissible/>
      <div className="odado-layout">
        <div className="odado-main-column">
          <section className="odado-panel odado-chart-panel" aria-label={`${pair.base}/${pair.quote} market`}>
            <div className="odado-market-heading">
              <MarketSelector/>
              <div className="odado-index"><p className="odado-mini-label">Index ratio</p><div><span data-testid="current-ratio" className="mono odado-ratio">{ratio?.toFixed(4) ?? "—"}</span><span className={`odado-change ${change === null ? "" : change >= 0 ? "is-positive" : "is-negative"}`}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}<small>Loaded history</small></span></div></div>
              <div className="odado-stock-prices">{([[stock(pair.base)!.name, pair.base, feed?.snapshot?.base], [stock(pair.quote)!.name, pair.quote, feed?.snapshot?.quote]] as const).map(([name, symbol, quote]) => <div key={symbol} title={`${name} · ${quoteTime(quote?.timestamp)}`}><p><Link href={"/news?symbol="+encodeURIComponent(symbol)} title={"Read "+symbol+" news"}>{name}</Link><span>{symbol}</span></p><span className="mono">{quote ? `$${money(quote.price)}` : "—"}</span></div>)}</div>
            </div>
            <OdadoFeedStatus alertsOnly/>
            <PairChart onHistoryChange={setChange}/>
            <div className="twun-compare-toggle"><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare?"Hide":"Show"} 2×2 comparison</button><span>Active order market: <strong>{pair.base}/{pair.quote}</strong></span></div>
            {compare&&<PairComparison range="7D"/>}
            <OdadoFeedStatus/>
          </section>
          <section className="odado-panel odado-activity" aria-label="Demo account activity">
            <div className="odado-activity-top"><div role="tablist" aria-label="Account views">{(["positions", "history"] as const).map((name, i) => <button key={name} role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "positions" : e.key === "End" ? "history" : i === 0 ? "history" : "positions"; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{name === "positions" ? "Positions" : "History"}<span>{name === "positions" ? state.positions.length : state.history.length}</span></button>)}</div><span className="odado-local-label"><Layers3 size={14}/>Demo account · Saved locally</span></div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>{tab === "positions" ? <PerpsPositions compact/> : <TradeHistory compact/>}</div>
          </section>
          <PairNews/>
        </div>
        <div className="odado-order-column"><PositionForm/><OdadoModel/><details className="odado-panel odado-disclosure odado-demo-controls"><summary>Demo controls<ChevronDown size={16}/></summary><DemoMarket/></details></div>
      </div>
      <footer className="odado-footer"><span>One ratio. Two perspectives.</span><span>Current release: demo · Simulated USDC</span></footer>
    </div>
  </main>;
}
