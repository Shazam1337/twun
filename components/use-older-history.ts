"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Pair,pairId} from "@/lib/catalog";
import {feedMessages,HistoryPoint} from "@/lib/market";
import {HistoryPage} from "@/lib/universe-feed";
const NO_POINTS:HistoryPoint[]=[];
export function useOlderHistory(pair:Pair,latest:HistoryPoint[]){
 const key=pairId(pair),[state,setState]=useState<{key:string;points:HistoryPoint[];loading:boolean;done:boolean;message:string;retryAt:number}>({key:"",points:[],loading:false,done:false,message:"",retryAt:0});
 const live=state.key===key?state:{key,points:NO_POINTS,loading:false,done:false,message:"",retryAt:0};
 const points=useMemo(()=>[...new Map([...live.points,...latest].map(p=>[p.timestamp,p])).values()].sort((a,b)=>a.timestamp-b.timestamp),[live.points,latest]);
 const current=useRef({key,pair,points,live});current.current={key,pair,points,live};
 const inFlight=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{inFlight.current=false;return()=>{controller.current?.abort();inFlight.current=false;};},[key]);
 const loadMore=useCallback(async()=>{
  const c=current.current,before=c.points[0]?.timestamp;
  if(inFlight.current||c.live.loading||!before||c.live.done||Date.now()<c.live.retryAt)return;
  if(c.points.length>=50000){setState({...c.live,done:true,message:"50,000 observations loaded — chart memory limit reached."});return;}
  inFlight.current=true;const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),30000);
  setState({...c.live,loading:true,message:"Loading earlier history…"});
  try{
   const r=await fetch("/api/history?"+new URLSearchParams({base:c.pair.base,quote:c.pair.quote,before:String(before)}),{cache:"no-store",signal:abort.signal});if(!r.ok)throw Error();
   const data:HistoryPage=await r.json();if(data.before!==before||pairId(data.pair)!==c.key)throw Error();if(current.current.key!==c.key)return;
   if(data.status!=="ready"){setState({...c.live,loading:false,message:feedMessages[data.status]??"Earlier history unavailable",retryAt:Math.max(data.retryAt||0,Date.now()+15000)});return;}
   const older=(data.history?.points??[]).filter(p=>Number.isFinite(p.timestamp)&&p.timestamp<before&&(p.value===null||(Number.isFinite(p.value)&&p.value>0)));
   if(data.hasMore&&!older.length)throw Error();
   setState({key:c.key,points:[...new Map([...c.points,...older].map(p=>[p.timestamp,p])).values()].sort((a,b)=>a.timestamp-b.timestamp),loading:false,done:!data.hasMore,message:data.hasMore?"":"No earlier observations returned for both stocks.",retryAt:0});
  }catch{if(current.current.key===c.key)setState({...c.live,loading:false,message:"Earlier history unavailable. Existing candles are unchanged.",retryAt:Date.now()+30000});}
  finally{clearTimeout(timeout);if(controller.current===abort){inFlight.current=false;controller.current=null;}}
 },[]);
 return {...live,points,loadMore};
}
