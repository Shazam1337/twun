"use client";

import { DEFAULT_PAIR, pairId } from "@/lib/catalog";
import { quoteTime } from "./market-status";
import { useDemo } from "./demo-store";
import { money, signed } from "@/lib/perps";

export function TradeHistory({ compact = false }: { compact?: boolean }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <p className="p-7 text-center text-xs">Loading demo activity…</p>;
  if (!state.history.length) return <div className={compact ? "odado-empty-history" : "border border-dashed border-[var(--line)] p-8 text-center"}><p className="text-sm font-bold">No demo activity yet</p><p className="mt-2 text-xs text-[#686057]">Opens, funding, closes and liquidations will appear here.</p></div>;
  return <div className="overflow-x-auto border border-[var(--line)]"><table className="w-full min-w-[940px] text-left text-[11px]"><thead className="bg-[var(--paper)] text-[10px] text-[#686057]"><tr>{["Demo time · UTC", "Event / position", "Side", "Ratio", "Notional", "Gross PnL", "Fee", "Funding paid (− received)", "Net realized"].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{state.history.map(e => <tr key={e.id} title={`${e.dataSource ?? "Simulation"} · Index ${quoteTime(e.indexTime)} · Entry index ${quoteTime(e.entryIndexTime)}`} className="border-t border-[var(--line)]"><td className="px-3 py-3 mono text-[#686057]">{new Date(e.time).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</td><td className="px-3 py-3"><span className={e.kind === "Liquidation" ? "font-bold text-[var(--red)]" : "font-bold"}>{e.kind}</span><span className="mt-1 block mono text-[9px] text-[#686057]">{pairId(e.pair??DEFAULT_PAIR)} · {e.positionId.slice(0,8)}</span>{e.shortfall > 0 && <span className="block text-[9px]">Demo shortfall {money(e.shortfall)}</span>}</td><td className="px-3 py-3">{e.side}</td><td className="px-3 py-3 mono">{e.ratio.toFixed(4)}</td><td className="px-3 py-3 mono">{money(e.notional)}</td><td className="px-3 py-3 mono">{["Close", "Liquidation"].includes(e.kind) ? signed(e.pnl) : "—"}</td><td className="px-3 py-3 mono">{money(e.fee)}</td><td className="px-3 py-3 mono">{e.kind === "Funding" ? signed(e.funding) : "—"}</td><td className={`px-3 py-3 mono ${e.net < 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>{["Close", "Liquidation"].includes(e.kind) ? signed(e.net) : "—"}</td></tr>)}</tbody></table></div>;
}
