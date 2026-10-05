"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useMarket} from "./market-store";
import type {TickerFeed,TickerItem} from "@/lib/stock-ticker";

const date=(t:number)=>new Date(t).toLocaleString("en-US",{timeZone:"UTC",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC";
function Item({item,duplicate=false}:{item:TickerItem;duplicate?:boolean}){
 const router=useRouter(),{selectPair}=useMarket();
 const pair={base:item.symbol,quote:item.symbol==="TSLA"?"NVDA":"TSLA"};
 const change=item.change24h,sign=change===null?"missing":change>0?"up":change<0?"down":"flat";
 return <button type="button" className="twun-stock-item" tabIndex={duplicate?-1:0} aria-label={`Trade ${pair.base}/${pair.quote}`} onClick={()=>{selectPair(pair);router.push("/trade");}} title={`${item.name} · Open ${pair.base}/${pair.quote}${item.timestamp?" · Quote: "+date(item.timestamp):" · Quote unavailable"}${item.referenceTime?" · 24h reference: "+date(item.referenceTime):" · 24h history unavailable"}`}>
  <div><strong>{item.symbol}</strong><span className="mono">{item.price===null?"—":item.price.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2})}</span><b className={"twun-stock-change "+sign}>{change===null?"—":`${change>0?"↗ +":change<0?"↘ −":""}${Math.abs(change).toFixed(2)}%`}<small>24h</small></b></div>
  <small>{item.price===null?"Quote unavailable":item.status!=="ready"?`${item.status==="cached"?"Cached": "Update unavailable"} · ${date(item.timestamp!)}`:date(item.timestamp!)}</small>
 </button>;
}
export function StockTicker(){
 const [feed,setFeed]=useState<TickerFeed|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const refresh=async()=>{try{const r=await fetch("/api/ticker",{cache:"no-store",signal:controller.signal});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.items))throw Error();if(active){setFeed(data);setFailed(false);}}catch{if(active)setFailed(true);}};
  void refresh();const timer=setInterval(()=>void refresh(),30000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[]);
 const hasPrices=feed?.items.some(i=>i.price!==null);
 return <aside className="twun-stock-ticker" aria-label="Stock quotes and 24-hour changes">
  <div className="twun-stock-caption"><span><b>THE STOCK TAPE</b><span>Twelve Data · USD · 24h change</span></span><span>Click a stock to trade ↗</span></div>
  {failed?<p className="twun-stock-empty" role="status">Market data connection unavailable</p>:!feed?<p className="twun-stock-empty" role="status">Loading stock quotes…</p>:!feed.configured?<p className="twun-stock-empty" role="status">Market data not configured</p>:!hasPrices?<p className="twun-stock-empty" role="status">Stock quotes not available yet</p>:<div className="twun-stock-viewport" aria-label="Stock prices. Select a stock to open its market."><div className="twun-stock-track">{[0,1].map(copy=><div className="twun-stock-group" key={copy} aria-hidden={copy===1?true:undefined}>{feed.items.map(item=><Item key={item.symbol} item={item} duplicate={copy===1}/>)}</div>)}</div></div>}
  <p className="twun-stock-footnote">{feed?.session==="closed"?"Market closed · ":""}Last available quotes · Cached prices are dated · 24h uses a 5-minute historical close; — means no matching history · Shared cache, not a live tick feed</p>
 </aside>;
}
