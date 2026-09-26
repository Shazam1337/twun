"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MarketFeed, tradeAllowed, Interval } from "@/lib/market";
import { DEFAULT_PAIR, Pair, pairId, validPair } from "@/lib/catalog";
import { Bundle, pairFeed } from "@/lib/universe-feed";
type MarketStore = { pair:Pair; selectPair:(p:Pair)=>void; setWatchPairs:(p:Pair[])=>void; setInterval:(i:Interval)=>void; feed:MarketFeed|null; feeds:Record<string,MarketFeed>; catalog:Bundle["catalog"]; canTrade:boolean; canTradePair:(p:Pair)=>boolean; loading:boolean; now:()=>number;refresh:()=>Promise<void> };
const MarketContext=createContext<MarketStore|null>(null);
export function MarketProvider({children}:{children:React.ReactNode}){
 const [pair,setPair]=useState<Pair>(DEFAULT_PAIR),[watch,setWatch]=useState<Pair[]>([]),[interval,setInterval]=useState<Interval>("1day");
 const [bundle,setBundle]=useState<Bundle|null>(null),[loading,setLoading]=useState(true),[connected,setConnected]=useState(true),[hydrated,setHydrated]=useState(false);
 const [,tick]=useState(0);const offset=useRef(0),generation=useRef(0);
 const now=useCallback(()=>Date.now()+offset.current,[]);
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem("odado-selected-pair")??"null");if(p&&validPair(p))setPair(p);}catch{}setHydrated(true);},[]);
 const selectPair=useCallback((p:Pair)=>{if(!validPair(p)||pairId(p)===pairId(pair))return;setPair(p);setLoading(true);try{localStorage.setItem("odado-selected-pair",JSON.stringify(p));}catch{}},[pair]);
 const setWatchPairs=useCallback((p:Pair[])=>setWatch(old=>JSON.stringify(old)===JSON.stringify(p)?old:p),[]);
 const symbols=[...new Set(watch.flatMap(p=>[p.base,p.quote]))].sort().join(",");
 const refresh=useCallback(async()=>{
  if(!hydrated)return;
  const ticket=++generation.current,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),40000);
  try{
   const response=await fetch("/api/market?"+new URLSearchParams({base:pair.base,quote:pair.quote,watch:symbols,interval}),{cache:"no-store",signal:controller.signal});
   if(!response.ok)throw Error();
   const data:Bundle=await response.json();if(!data.market||!data.quotes||!Number.isFinite(data.serverTime))throw Error();
   if(ticket===generation.current){offset.current=data.serverTime-Date.now();setBundle(data);setConnected(true);}
  }catch{if(ticket===generation.current)setConnected(false);}
  finally{clearTimeout(timeout);if(ticket===generation.current)setLoading(false);}
 },[pair.base,pair.quote,symbols,interval,hydrated]);
 useEffect(()=>{void refresh();const poll=window.setInterval(()=>void refresh(),15000);return()=>{generation.current++;clearInterval(poll);};},[refresh]);
 useEffect(()=>{const timer=window.setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer);},[]);
 const feeds:Record<string,MarketFeed>={};
 for(const p of [pair,...watch]){
  let f=bundle?pairFeed(p,bundle.quotes,now(),bundle.market.status!=="not_configured"):null;
  if(f&&bundle?.market.pair&&pairId(bundle.market.pair)===pairId(p))f={...f,histories:bundle.market.histories};
  if(f&&bundle)f={...f,serverTime:bundle.serverTime};
  if(f&&!connected)f={...f,status:"unavailable",message:"Market data connection lost — calculations paused",canTrade:false};
  if(f)feeds[pairId(p)]=f;
 }
 const feed=feeds[pairId(pair)]??null;
 return <MarketContext.Provider value={{pair,selectPair,setWatchPairs,setInterval,feed,feeds,catalog:bundle?.catalog??{},canTrade:tradeAllowed(feed,now()),canTradePair:p=>tradeAllowed(feeds[pairId(p)]??null,now()),loading,now,refresh}}>{children}</MarketContext.Provider>;
}
export function useMarket(){const value=useContext(MarketContext);if(!value)throw Error("MarketProvider required");return value;}
