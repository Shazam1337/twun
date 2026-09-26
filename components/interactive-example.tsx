"use client";

import { useState } from "react";
import Link from "next/link";
import { FEE_RATE, pnl, Position, Side, signed } from "@/lib/perps";

export function InteractiveExample() {
  const [mark, setMark] = useState(.55);
  const [side, setSide] = useState<Side>("Long");
  const position: Position = { id: "example", side, margin: 100, leverage: 5, notional: 500, entryRatio: .5, entryFee: 500 * FEE_RATE, funding: 0, openedAt: 0, lastFundingAt: 0 };
  const result = pnl(position, mark);
  return <section className="border-t border-[var(--line)] bg-[var(--paper)] px-5 py-14 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]">
    <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-2"><div><p className="eyebrow text-[#686057]">Hypothetical payoff · not market data</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-.055em]">Put the ratio to work.</h2><p className="mt-4 max-w-md text-sm leading-relaxed text-[#686057]">100 USDC of isolated margin at 5x gives 500 USDC of entry notional. A move from 0.50 to 0.55 produces +50 USDC for Long, before fees and funding.</p><Link href="/trade" className="mt-5 inline-block text-xs font-bold underline underline-offset-4">Open the real-data demo ↗</Link></div>
    <div className="border border-[var(--line)] bg-[var(--milk)] p-6"><div className="mb-4 flex gap-2">{(["Long", "Short"] as const).map(s => <button key={s} onClick={() => setSide(s)} className={`border border-[var(--line)] px-4 py-2 text-xs font-bold ${s === side ? "bg-[var(--ink)] text-[var(--milk)]" : ""}`}>{s}</button>)}</div><div className="flex justify-between"><div><p className="eyebrow text-[#686057]">Ratio · Entry 0.50</p><p className="mt-2 mono text-3xl">{mark.toFixed(2)}</p></div><div className="text-right"><p className="eyebrow text-[#686057]">Gross PnL · USDC</p><p className={`mt-2 mono text-3xl ${result < 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>{signed(result)}</p></div></div><input aria-label="Example ratio" className="range-track my-5 w-full" type="range" min=".45" max=".55" step=".01" value={mark} onChange={e => setMark(Number(e.target.value))}/><p className="text-[11px] leading-relaxed text-[#686057]">Hypothetical numbers, not a quote · Entry and exit fee: 0.25 USDC each. Funding excluded. Changes here do not affect your account.</p></div></div>
  </section>;
}
