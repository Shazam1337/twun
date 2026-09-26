"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useMarket } from "./market-store";
import { historySeries } from "@/lib/market";

export function TerminalPreview() {
  const { feed, pair } = useMarket();
  const series = historySeries(feed, "30D");
  return <div className="odado-panel odado-preview p-5"><div className="mb-4 flex items-center justify-between border-b border-[#e9e5df] pb-4"><div><span className="eyebrow text-[#7c7670]">Odado / PERPETUAL / DEMO</span><p className="mt-1 text-2xl font-extrabold tracking-[-.05em]">{pair.base} / {pair.quote}</p></div><p className="mono text-xl">{feed?.snapshot?.ratio.toFixed(4) ?? "—"} <span className="text-xs text-[#7c7670]">ratio</span></p></div><div className="grid gap-3 lg:grid-cols-[1fr_280px]"><div className="relative min-w-0 border border-[#e9e5df] p-5"><span className="eyebrow text-[#7c7670]">Ratio index</span><div className="mt-5 h-[230px]">{series.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={series}><YAxis hide domain={["dataMin","dataMax"]}/><Line dot={false} connectNulls={false} isAnimationActive={false} type="linear" dataKey="value" stroke="#36826a" strokeWidth={2} fill="#159a6820"/></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-[#7c7670]">{feed?.message ?? "Loading market data…"}</div>}</div><span className="absolute bottom-3 right-5 mono text-[10px] text-[#7c7670]">Twelve Data · Matched closes · 30D</span></div><div className="border border-[#e9e5df] p-4"><p className="eyebrow text-[#7c7670]">Illustrative setup</p><div className="mt-4 grid grid-cols-2 border border-[#e9e5df] text-center text-xs font-bold"><span className="bg-[#dcece3] text-[#24674b] p-3">Long ↗</span><span className="p-3">Short ↘</span></div><div className="mt-4 bg-[#f3f0eb] p-3"><span className="text-[10px] text-[#7c7670]">ISOLATED MARGIN</span><p className="mt-1 text-xl font-bold">100 <span className="text-xs">USDC</span></p></div><div className="my-4 flex justify-between text-xs"><span>5x leverage</span><span className="mono">500 USDC notional</span></div><Link href="/trade" className="odado-primary-link w-full justify-center">Open demo terminal ↗</Link></div></div></div>;
}
