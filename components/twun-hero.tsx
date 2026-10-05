"use client";
import Link from "next/link";
import {ArrowUpRight, ArrowDownUp} from "lucide-react";
import {Line,LineChart,ResponsiveContainer,YAxis} from "recharts";
import {useMarket} from "./market-store";
import {historySeries} from "@/lib/market";
import {stock} from "@/lib/catalog";
export function TwunHero(){
 const {feed,pair,selectPair}=useMarket();
 const data=historySeries(feed,"30D");
 return <div className="twun-lab">
  <div className="twun-window-bar"><span className="twun-window-dots"><i/><i/><i/></span><span>TWUN LAB / RATIO TERMINAL</span><b>DEMO</b></div>
  <div className="twun-lab-grid"><aside className="twun-lab-sidebar">{[{base:"NVDA",quote:"TSLA"},{base:"AAPL",quote:"MSFT"},{base:"GOOGL",quote:"META"}].map(p=><button key={p.base} className={pair.base===p.base&&pair.quote===p.quote?"active":""} onClick={()=>selectPair(p)} aria-label={"Preview "+p.base+"/"+p.quote}><b>{p.base.slice(0,1)}</b><strong>{p.base}</strong><small>vs {p.quote}</small></button>)}<div><b>50</b><small>US STOCKS</small></div></aside>
  <div className="twun-lab-main">
   <div className="twun-lab-title"><div><p className="twun-micro">TWO STOCKS. ONE PERSPECTIVE.</p><h2>{pair.base} / {pair.quote}</h2></div><span className="twun-stamp">REAL PRICES<br/>DEMO TRADING</span></div>
   <p className="twun-lab-caption">{stock(pair.base)?.name} against {stock(pair.quote)?.name}.<br/>A synthetic price ratio. No share ownership.</p>
   <div className="twun-lab-chart"><div><span>MATCHED CLOSES / 30D</span><ArrowDownUp size={13}/></div>{data.filter(p=>p.value!==null).length>1?<ResponsiveContainer width="100%" height={155}><LineChart data={data}><YAxis hide domain={["dataMin","dataMax"]}/><Line dataKey="value" stroke="#2851ff" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>:<p>{feed?.message??"Loading market data…"}</p>}</div>
   <div className="twun-lab-direction"><span>↗ LONG THE RATIO</span><span>↘ SHORT THE RATIO</span></div>
   <div className="twun-receipt"><div><p className="twun-micro">STOCK-PERFORMANCE INDEX</p><strong>{pair.base} ÷ {pair.quote}</strong><small>Source: Twelve Data<br/>Execution: local simulation</small></div><div><b className="mono">{feed?.snapshot?.ratio.toFixed(4)??"—"}</b><small>USD / USD</small></div></div>
   <Link href="/trade" className="twun-lab-launch">Open the demo terminal <ArrowUpRight size={16}/></Link>
  </div></div>
 </div>;
}
