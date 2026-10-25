"use client";
import {useEffect,useState} from "react";
import {Pair,PRESETS,pairId,validPair} from "@/lib/catalog";
import {ChartRange} from "@/lib/perps";
import {MarketFeed,historySeries,historyChange} from "@/lib/market";
import {useMarket} from "./market-store";

function ComparisonCell({pair,range,index,onActivate,onReplace,options}:{pair:Pair;range:ChartRange;index:number;onActivate:()=>void;onReplace:(p:Pair)=>void;options:Pair[]}){
 const market=useMarket(),active=pairId(market.pair)===pairId(pair),key=pairId(pair),interval=range==="1D"||range==="7D"?"1min":"1day";
 const [result,setResult]=useState<{key:string;feed:MarketFeed|null;failed:boolean}>({key:"",feed:null,failed:false});
 useEffect(()=>{
  if(active)return;
  let controller=new AbortController(),stopped=false,timer:ReturnType<typeof setTimeout>;
  const load=async()=>{controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),40000);try{
   const response=await fetch("/api/market?"+new URLSearchParams({base:pair.base,quote:pair.quote,interval,historySeconds:"900"}),{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(!data.market||!data.market.pair||pairId(data.market.pair)!==key)throw Error();
   if(!stopped)setResult({key,feed:data.market,failed:false});
  }catch{if(!stopped)setResult({key,feed:null,failed:true});}finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(()=>void load(),60000);}};
  timer=setTimeout(()=>void load(),index*500);return()=>{stopped=true;controller.abort();clearTimeout(timer);};
 },[key,interval,active,index]);
 const feed=active?market.feed:result.key===key?result.feed:null,points=historySeries(feed,range,active?market.interval:interval),good=points.filter(p=>p.value!==null);
 const min=Math.min(...good.map(p=>p.value!)),max=Math.max(...good.map(p=>p.value!)),span=max-min||.001;
 const start=points[0]?.timestamp??0,end=points.at(-1)?.timestamp??start+1;
 let path="",pen=false;for(const p of points){if(p.value===null){pen=false;continue;}const x=12+(p.timestamp-start)/Math.max(1,end-start)*400,y=115-(p.value-min)/span*80;path+=`${pen?"L":"M"}${x.toFixed(2)},${y.toFixed(2)} `;pen=true;}
 const change=historyChange(points),status=feed?.status==="ready"?(feed.histories[active?market.interval:interval]?.status??"History pending"):feed?.message??(result.failed?"Data unavailable":"Loading cached data…");
 return <article className={"twun-compare-cell"+(active?" is-active":"")} aria-label={`Comparison ${index+1}`}><header><select aria-label={`Comparison pair ${index+1}`} value={key} onChange={e=>{const p=options.find(p=>pairId(p)===e.target.value);if(p)onReplace(p);}}>{options.map(p=><option key={pairId(p)} value={pairId(p)}>{pairId(p)}</option>)}</select><span>{active?"Active order market":"Read-only comparison"}</span></header><div className="twun-compare-value"><strong className="mono">{feed?.snapshot?.ratio.toFixed(5)??"—"}</strong><span className={change!==null&&change<0?"is-negative":"is-positive"}>{change===null?"—":`${change>=0?"+":""}${change.toFixed(2)}%`} · {range}</span></div>{good.length>1?<svg viewBox="0 0 480 145" role="img" aria-label={`${key} historical ratio`}><path d="M12 35H412M12 75H412M12 115H412" fill="none" stroke="#edf0f6"/><path d={path} fill="none" stroke={change!==null&&change<0?"#d94d58":"#2851ff"} strokeWidth="2"/><text x="420" y="39">{max.toFixed(3)}</text><text x="420" y="119">{min.toFixed(3)}</text></svg>:<div className="twun-compare-empty">No matched ratio history</div>}<footer><small title={feed?.message}>{status} · {good.length} observations</small><button disabled={active} onClick={onActivate}>{active?"Selected":"Trade this pair ↗"}</button></footer></article>;
}
export function PairComparison({range}:{range:ChartRange}){
 const {pair,selectPair}=useMarket();
 const [slots,setSlots]=useState<Pair[]>(()=>[pair,...PRESETS.filter(p=>pairId(p)!==pairId(pair))].slice(0,4));
 const [custom,setCustom]=useState<Pair[]>([]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("twun-comparison-v1")??"null");if(Array.isArray(saved)&&saved.length===4&&saved.every(validPair))setSlots(saved);const created=JSON.parse(localStorage.getItem("odado-created-pairs")??"[]");if(Array.isArray(created))setCustom(created.filter(validPair));}catch{}},[]);
 const options=[...new Map([...slots,pair,...custom,...PRESETS].map(p=>[pairId(p),p])).values()];
 return <section className="twun-comparison-grid" aria-label="Four pair comparison">{slots.map((p,i)=><ComparisonCell key={i} pair={p} range={range} index={i} options={options} onReplace={next=>{const updated=slots.map((s,n)=>n===i?next:s);setSlots(updated);try{localStorage.setItem("twun-comparison-v1",JSON.stringify(updated));}catch{}}} onActivate={()=>selectPair(p)}/>)}<p>Shared {range} lookback · Matched close ratios, not exchange order books. Other charts refresh from the shared server cache every 60s; API quotas may limit coverage. Comparisons never revalue your positions.</p></section>;
}
