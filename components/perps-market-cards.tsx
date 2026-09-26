"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useMarket } from "./market-store";
import { historySeries } from "@/lib/market";

export function PerpsMarketCards() {
  const { feed, pair } = useMarket();
  const series = historySeries(feed, "30D");
  return <section className="border-b border-[var(--line)] px-5 py-12 sm:px-10 lg:px-[max(48px,calc((100vw-1200px)/2))]">
    <div className="mx-auto max-w-[1200px]"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-2 text-[#645c54]">01 / 50 stocks · Your perspective</p><h2 className="text-3xl font-extrabold tracking-[-.045em]">A different kind of market.</h2></div><p className="text-xs font-medium text-[#645c54]">Twelve Data index · Simulated execution</p></div>
      <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
        <Link href="/trade" className="flex min-h-[180px] flex-col justify-between bg-[var(--milk)] p-5 hover:bg-[var(--paper)]"><div className="flex justify-between"><div><span className="eyebrow text-[#645c54]">Ratio perpetual · Demo</span><h3 className="mt-3 text-lg font-extrabold">{pair.base} / {pair.quote}</h3><p className="mt-1 text-xs text-[#5b534c]">{pair.base} vs {pair.quote}</p></div><div className="h-14 w-28">{series.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={series}><YAxis hide domain={["dataMin", "dataMax"]}/><Line type="linear" dot={false} connectNulls={false} isAnimationActive={false} dataKey="value" stroke="#159a68"  strokeWidth={1.5}/></LineChart></ResponsiveContainer> : <span className="block pt-4 text-right text-[10px] text-[#645c54]">Data unavailable</span>}</div></div><p className="mono mt-5 text-xs font-medium">Index ratio {feed?.snapshot?.ratio.toFixed(4) ?? "—"} <span className="float-right">Trade ↗</span></p></Link>
        <div className="flex min-h-[180px] flex-col justify-between bg-[var(--milk)] p-5"><span className="eyebrow text-[#645c54]">Choose a direction</span><h3 className="text-2xl font-extrabold tracking-[-.04em]">Long ↗ / Short ↘</h3><p className="text-xs leading-relaxed text-[#5b534c]">Long profits when the ratio rises.<br/>Short profits when it falls.</p></div>
        <div className="flex min-h-[180px] flex-col justify-between bg-[var(--milk)] p-5"><span className="eyebrow text-[#645c54]">Isolated demo USDC</span><h3 className="text-2xl font-extrabold tracking-[-.04em]">1–10x leverage</h3><p className="text-xs leading-relaxed text-[#5b534c]">Set your margin. Know your liquidation level.<br/>Fees and funding shown separately.</p></div>
      </div>
    </div>
  </section>;
}
