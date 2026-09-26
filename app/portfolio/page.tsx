"use client";
import Link from "next/link";
import { TradeHistory } from "@/components/trade-history";
import { ResetDemo } from "@/components/reset-demo";
import { PerpsPositions } from "@/components/perps-positions";
import { PerpsNotice } from "@/components/perps-notice";
import { useDemo } from "@/components/demo-store";
import { OdadoFeedStatus, OdadoModel } from "@/components/odado-market";
import { INITIAL_USDC, money, signed, totals } from "@/lib/perps";

export default function PortfolioPage() {
  const { state, hydrated } = useDemo();
  const t = totals(state);
  return <main className="odado-workspace odado-portfolio">
    <div className="odado-page-heading"><div><p className="odado-kicker">Portfolio / Demo account</p><h1>Your ratio positions.</h1><p>Simulated USDC. Connected wallet funds are always separate.</p></div><ResetDemo/></div>
    <PerpsNotice dismissible/>
    <div className="odado-panel odado-portfolio-feed"><OdadoFeedStatus alertsOnly/><OdadoFeedStatus/></div>
    <div className="odado-account-cards">
      <section className="odado-panel"><p>Account equity</p><h2 className="mono">{hydrated ? money(t.equity) : "—"} <small>USDC</small></h2><span className={t.equity < INITIAL_USDC ? "is-negative" : "is-positive"}><span className="mono">{signed(t.equity - INITIAL_USDC)}</span> since demo start</span></section>
      <section className="odado-panel"><p>Free balance</p><h2 data-testid="portfolio-free" className="mono">{money(state.freeUsdc)} <small>USDC</small></h2><span>Available for margin and entry fees</span></section>
      <section className="odado-panel"><p>Isolated margin</p><h2 className="mono">{money(t.margin)} <small>USDC</small></h2><span>{state.positions.length} open positions · collateral reserved</span></section>
    </div>
    <section className="odado-panel odado-account-metrics">{[["Gross unrealized PnL", signed(t.pnl)], ["Net realized PnL", signed(t.realized)], ["Fees paid", money(t.fees)], ["Funding paid / received (−)", signed(t.funding)]].map(([label, value]) => <div key={label}><p>{label}</p><strong className="mono">{value}</strong><span>USDC</span></div>)}</section>
    <section className="odado-panel odado-activity"><div className="odado-section-heading"><h2>Positions <span>{state.positions.length}</span></h2><Link href="/trade">Open terminal ↗</Link></div><PerpsPositions compact/></section>
    <section className="odado-panel odado-activity"><div className="odado-section-heading"><h2>History <span>{state.history.length}</span></h2><span>Demo account · Saved locally</span></div><TradeHistory compact/></section>
    <OdadoModel/>
    <footer className="odado-footer"><span>Reset affects only this real-data demo account.</span><span>Odado · No signatures or transactions</span></footer>
  </main>;
}
