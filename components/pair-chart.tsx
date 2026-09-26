"use client";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartRange, num as displayNumber } from "@/lib/perps";
import { historySeries, historyChange, feedMessages } from "@/lib/market";
import { useMarket } from "./market-store";

export function PairChart({ range }: { range: ChartRange }) {
  const { feed, loading, pair } = useMarket();
  const data = historySeries(feed, range);
  const history = feed?.histories[range === "1D" || range === "7D" ? "5min" : "1day"];
  const values = data.flatMap(p => p.value === null ? [] : [p.value]);
  const color = (historyChange(data) ?? 0) >= 0 ? "#36826a" : "#bc655c";
  const pad = (Math.max(...values) - Math.min(...values)) * .15 || .01;
  const timezone = history?.interval === "1day" ? "America/New_York" : "UTC";
  if (values.length < 2) return <div className="odado-chart-empty"><strong>{loading ? "Loading ratio history…" : "Ratio history unavailable"}</strong><p>{feed?.status === "not_configured" ? "Connect Twelve Data to see matched stock closing prices." : history&&history.status!=="ready" ? feedMessages[history.status] : "Waiting for validated, matching closing-price observations."}</p><small>No synthetic points or estimated candles</small></div>;
  return <><div className="odado-chart" aria-label="Historical closing-price ratio chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 18, right: 14, left: 20, bottom: 12 }}>
    <CartesianGrid stroke="#ece7e0" strokeDasharray="3 5" vertical={false}/>
    <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={n => new Date(n).toLocaleString("en-US", range === "1D" ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false } : { month: "short", day: "numeric", timeZone: timezone })} axisLine={false} tickLine={false} tick={{ fontFamily: "DM Mono", fontSize: 12, fill: "#9b9084" }} minTickGap={55} tickMargin={14} height={38}/>
    <YAxis orientation="right" axisLine={false} tickLine={false} domain={[Math.min(...values) - pad, Math.max(...values) + pad]} tickFormatter={v => displayNumber(v, 4)} tick={{ fontFamily: "DM Mono", fontSize: 12, fill: "#9b9084" }} width={68} tickMargin={10} tickCount={6}/>
    <Tooltip cursor={{ stroke: "#b2a596", strokeDasharray: "3 4" }} content={({ active, payload, label }) => active && payload?.length ? <div className="odado-chart-tooltip"><p>{new Date(Number(label)).toLocaleString("en-GB", history?.interval === "1day" ? { timeZone: timezone, day: "numeric", month: "short", year: "numeric" } : { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{history?.interval === "1day" ? " · ET session" : " UTC"}</p><div><span>{pair.base} / {pair.quote}</span><strong className="mono">{displayNumber(Number(payload[0].value), 6)}</strong></div><small>Matched closing prices</small></div> : null}/>
    <Line isAnimationActive={false} type="linear" dataKey="value" stroke={color} strokeWidth={2.25} dot={false} activeDot={{ r: 5, stroke: "#fcfbf8", strokeWidth: 3, fill: color }} connectNulls={false}/>
  </LineChart></ResponsiveContainer></div>{history?.status !== "ready" && <p role="status" className="odado-history-note">History refresh failed. Showing previously cached closes.</p>}</>;
}
