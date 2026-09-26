"use client";

import { DEFAULT_PAIR, pairId } from "@/lib/catalog";
import { useState } from "react";
import { useMarket } from "./market-store";
import { quoteTime } from "./market-status";
import { useDemo } from "./demo-store";
import { closeFee, equity, liquidationRatio, maintenance, money, netIfClosed, num, pnl, signed } from "@/lib/perps";

export function PerpsPositions({ compact = false }: { compact?: boolean }) {
  const { state, close, hydrated } = useDemo();
  const { canTradePair } = useMarket();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const chosen = state.positions.find(p => p.id === reviewId);
  return <section aria-label="Open positions" className={compact ? "odado-positions" : ""}>
    {!compact && <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold tracking-[-.04em]">Open positions <span className="mono text-xs font-normal text-[#686057]">/ {state.positions.length}</span></h2><span className="eyebrow text-[#686057]">Isolated · Demo USDC</span></div>}
    {!state.positions.length ? <div className="border border-dashed border-[var(--line)] p-9 text-center"><p className="text-sm font-bold">{hydrated ? "No open positions" : "Loading positions…"}</p><p className="mt-2 text-xs text-[#686057]">Choose Long or Short to trade a stock-performance ratio.</p></div> : <div className="overflow-x-auto border border-[var(--line)]"><table className="w-full min-w-[1050px] text-left text-[11px]"><thead className="bg-[var(--paper)] text-[10px] text-[#686057]"><tr>{["Contract / side", "Margin / size", "Entry / current", "Gross PnL", "Funding paid", "Fees · entry / exit est.", "Equity / maintenance", "Liquidation ratio", "Net if closed", ""].map((label, i) => <th className="px-3 py-3 font-medium" key={i}>{label}</th>)}</tr></thead><tbody>{state.positions.map(p => <tr data-testid="position-row" key={p.id} className="border-t border-[var(--line)]">
      <td className="px-3 py-4" title={`${p.dataSource ?? ""} · Entry index ${quoteTime(p.entryIndexTime)}`}><p className="font-bold">{pairId(p.pair??DEFAULT_PAIR)}</p><small>{canTradePair(p.pair??DEFAULT_PAIR)?"Index current":"Valuation frozen"}</small><span className={p.side === "Long" ? "text-[var(--green)]" : "text-[var(--red)]"}>{p.side} · {p.leverage}x</span></td>
      <td className="px-3 py-4 mono">{money(p.margin)}<span className="mt-1 block text-[#686057]">{money(p.notional)} USDC</span></td>
      <td className="px-3 py-4 mono">{p.entryRatio.toFixed(4)}<span className="mt-1 block text-[#686057]">{(p.mark ?? state.mark).toFixed(4)}</span></td>
      <td data-testid="position-pnl" className={`px-3 py-4 mono font-bold ${pnl(p, p.mark ?? state.mark) < 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>{signed(pnl(p, p.mark ?? state.mark))}</td>
      <td className="px-3 py-4 mono">{signed(p.funding)}<span className="mt-1 block text-[9px] text-[#686057]">negative = received</span></td>
      <td className="px-3 py-4 mono">{money(p.entryFee)} / {money(closeFee(p))}</td>
      <td className="px-3 py-4 mono">{money(equity(p, p.mark ?? state.mark))}<span className="mt-1 block text-[#686057]">MM {money(maintenance(p))}</span></td>
      <td className="px-3 py-4 mono">{num(liquidationRatio(p), 6)}</td>
      <td className={`px-3 py-4 mono ${netIfClosed(p, p.mark ?? state.mark) < 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>{signed(netIfClosed(p, p.mark ?? state.mark))}</td>
      <td className="px-3 py-4"><button disabled={!canTradePair(p.pair??DEFAULT_PAIR)} title={canTradePair(p.pair??DEFAULT_PAIR) ? "Close at the current index" : "Valid synchronized prices required; fresh quotes during open hours"} onClick={() => setReviewId(p.id)} className="border border-[var(--line)] px-3 py-2 text-xs font-bold hover:bg-[var(--paper)] disabled:opacity-40">Close</button></td>
    </tr>)}</tbody></table></div>}
    {!!state.positions.length && <p className="mt-2 text-[10px] text-[#686057]">Each position uses its own accepted stock-price index. Invalid feeds stay frozen; closed-session demo orders use the last valid prices. Entry source/time on each contract row.</p>}
    {message && <p role="status" className="mt-3 text-xs">{message}</p>}
    {chosen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c292799] p-5"><section role="dialog" aria-modal="true" aria-label="Close position" className="w-full max-w-md bg-[var(--milk)] p-6"><p className="eyebrow">Demo settlement</p><h2 className="my-3 text-2xl font-extrabold tracking-[-.04em]">Close {chosen.side} {pairId(chosen.pair??DEFAULT_PAIR)}?</h2><dl className="my-5 space-y-3 text-sm">{[["Gross PnL", signed(pnl(chosen, chosen.mark ?? state.mark))], ["Funding paid / received (−)", signed(chosen.funding)], ["Closing fee", money(closeFee(chosen))], ["Returned to free balance", money(Math.max(0, equity(chosen, chosen.mark ?? state.mark) - closeFee(chosen)))], ["Net result after all costs", signed(netIfClosed(chosen, chosen.mark ?? state.mark))]].map(([label, value]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd className="mono">{value} USDC</dd></div>)}</dl><button autoFocus disabled={!canTradePair(chosen.pair??DEFAULT_PAIR)} onClick={() => { const r = close(chosen.id); setMessage(r.ok ? r.message : r.error); setReviewId(null); }} className="h-11 w-full bg-[var(--ink)] text-xs font-bold text-[var(--milk)]">Confirm close</button><button onClick={() => setReviewId(null)} className="mt-2 h-9 w-full text-xs">Cancel</button></section></div>}
  </section>;
}
