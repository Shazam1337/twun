"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Info, X } from "lucide-react";
import { useMarket } from "./market-store";
import { useDemo } from "./demo-store";
import { FEE_RATE, FUNDING_RATE, liquidationRatio, money, num, Position, Side } from "@/lib/perps";

export function PositionForm() {
  const { state, hydrated, open } = useDemo();
  const { canTrade, pair, feed } = useMarket();
  const mark=feed?.snapshot?.ratio ?? 0;
  const [side, setSide] = useState<Side>("Long");
  const [margin, setMargin] = useState("100");
  const [leverage, setLeverage] = useState(5);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(()=>{setReview(false);setMessage("");},[pair.base,pair.quote]);
  const m = Number(margin);
  const validAmount = Number.isFinite(m) && m >= 1;
  const notional = validAmount ? m * leverage : 0;
  const fee = notional * FEE_RATE;
  const enough = m + fee <= state.freeUsdc;
  const preview: Position = { id: "preview", side, margin: m, leverage, notional, entryRatio: mark, entryFee: fee, funding: 0, openedAt: state.clock, lastFundingAt: state.clock };
  const valid = hydrated && canTrade && mark > 0 && validAmount && enough;
  const submit = () => { const result = open(side, m, leverage); setReview(false); setMessage(result.ok ? result.message : result.error); };
  return <aside aria-label="Open demo position" className="odado-panel odado-order">
    <div className="odado-order-heading"><h2>Place an order</h2><span>Isolated · USDC</span></div>
    <div className="odado-side-toggle">{(["Long", "Short"] as const).map(s => <button key={s} aria-pressed={side === s} onClick={() => { setSide(s); setMessage(""); }} className={side === s ? (s === "Long" ? "is-long" : "is-short") : ""}>{s} <span>{s === "Long" ? "↗" : "↘"}</span></button>)}</div>
    <div className="odado-margin-head"><label htmlFor="isolated-margin">Margin</label><span>Available <span data-testid="free-balance" className="mono">{hydrated ? money(state.freeUsdc) : "—"}</span></span></div>
    <div className="odado-margin-input"><input id="isolated-margin" aria-label="Isolated margin" inputMode="decimal" value={margin} onChange={e => { setMargin(e.target.value); setMessage(""); }} className="mono"/><div><span>USDC</span><button type="button" onClick={() => setMargin(String(Math.floor(state.freeUsdc / (1 + leverage * FEE_RATE) * 100) / 100))}>Max</button></div></div>
    <div className="odado-leverage"><div><label htmlFor="leverage">Leverage</label><span className="mono">{leverage}x</span></div><input id="leverage" aria-label="Leverage" type="range" min="1" max="10" step="1" value={leverage} onChange={e => setLeverage(Number(e.target.value))}/><div className="odado-leverage-steps">{[1, 3, 5, 10].map(v => <button key={v} aria-label={`Set leverage to ${v}x`} aria-pressed={leverage === v} onClick={() => setLeverage(v)}><span className="mono">{v}x</span></button>)}</div></div>
    <div className="odado-notional"><span>Position size</span><strong data-testid="position-notional"><span className="mono">{money(notional)}</span> <span>USDC</span></strong></div>
    <button disabled={!valid} onClick={() => setReview(true)} className="odado-submit">{!hydrated ? "Loading demo…" : !validAmount ? "Minimum margin 1 USDC" : !enough ? "Insufficient demo USDC" : !canTrade ? "Market data unavailable" : `Review ${side}`}<ArrowUpRight size={17}/></button>
    <p className="odado-signature-note"><Info size={13}/>Demo USDC. No wallet signature.</p>
    {message && <p role="status" className="odado-order-message">{message}</p>}
    <dl className="odado-order-details">
      <div><dt>Entry ratio</dt><dd className="mono">{mark > 0 ? mark.toFixed(4) : "—"}</dd></div>
      <div><dt>Est. liquidation</dt><dd data-testid="preview-liquidation" className="mono">{validAmount && mark > 0 ? num(liquidationRatio(preview), 6) : "—"}</dd></div>
      <div><dt>Entry fee <span>0.05%</span></dt><dd><span className="mono">{money(fee)}</span> USDC</dd></div>
      <div><dt>Funding / 8h <span>{side === "Long" ? "pay" : "receive"}</span></dt><dd><span className="mono">{num(notional * FUNDING_RATE, 4)}</span> USDC</dd></div>
      <div className="odado-total"><dt>Total debit</dt><dd><span className="mono">{money((validAmount ? m : 0) + fee)}</span> USDC</dd></div>
    </dl>
    {review && <div className="odado-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Review position" className="odado-modal">
      <div className="odado-modal-top"><span>Demo · isolated perpetual</span><button aria-label="Cancel position review" onClick={() => setReview(false)}><X size={20}/></button></div><h2>{side} {pair.base}/{pair.quote} · {leverage}x</h2>
      <dl className="odado-order-details">{[["Margin", money(m) + " USDC"], ["Entry notional", money(notional) + " USDC"], ["Entry ratio", mark > 0 ? mark.toFixed(4) : "—"], ["Entry fee", money(fee) + " USDC"], ["Est. liquidation", num(liquidationRatio(preview), 6)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="mono">{value}</dd></div>)}</dl>
      <p>{feed?.session.state === "closed" ? "Market closed · Demo trading at last available prices. " : ""}Funding and closing fee are separate. Liquidation occurs when isolated equity reaches 5% of entry notional. No wallet approval is required.</p>
      {!canTrade && <p role="alert" className="odado-order-message">Market data unavailable. Confirmation is paused.</p>}
      <button autoFocus disabled={!valid} onClick={submit} className="odado-submit">Confirm {side}</button><button onClick={() => setReview(false)} className="odado-cancel">Cancel</button>
    </section></div>}
  </aside>;
}
