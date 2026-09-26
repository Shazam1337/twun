"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import {LEGACY_KEY,PERPS_KEY,PerpsState,Result,Side} from "@/lib/perps";
import {ARCHIVE_KEY,isLiveAccount,LIVE_KEY} from "@/lib/live-account";
import {actOnPair,adoptPair,isMultiAccount,migrateAccount,MULTI_KEY,MultiAccount} from "@/lib/multi-account";
import {DEFAULT_PAIR,Pair,pairId} from "@/lib/catalog";
import {useMarket} from "./market-store";
type Store={state:MultiAccount;hydrated:boolean;storageWarning:string;legacyPresent:boolean;open:(side:Side,margin:number,leverage:number)=>Result;close:(id:string)=>Result;advance:()=>Result;reset:()=>void};
const DemoContext=createContext<Store|null>(null);
export function DemoProvider({children}:{children:React.ReactNode}){
 const [state,setState]=useState(()=>migrateAccount()),current=useRef(state);
 const [hydrated,setHydrated]=useState(false),[storageWarning,setStorageWarning]=useState(""),[legacyPresent,setLegacyPresent]=useState(false);
 const {pair,feeds,now,setWatchPairs}=useMarket();
 const commit=useCallback((next:PerpsState)=>{const s=next as MultiAccount;current.current=s;setState(s);try{localStorage.setItem(MULTI_KEY,JSON.stringify(s));setStorageWarning("");}catch{setStorageWarning("Browser storage unavailable: this demo session will not survive a reload.");}},[]);
 useEffect(()=>{
  let next=current.current;
  try{
   const synthetic=localStorage.getItem(PERPS_KEY);
   setLegacyPresent(!!(synthetic||localStorage.getItem(LEGACY_KEY)||localStorage.getItem(ARCHIVE_KEY)));
   if(synthetic&&!localStorage.getItem(ARCHIVE_KEY))localStorage.setItem(ARCHIVE_KEY,synthetic);
   const raw=localStorage.getItem(MULTI_KEY);
   if(raw){const saved=JSON.parse(raw);if(isMultiAccount(saved))next=saved;}
   else {const previous=localStorage.getItem(LIVE_KEY);if(previous){const saved=JSON.parse(previous);if(isLiveAccount(saved))next=migrateAccount(saved);}}
  }catch{}
  commit(next);setHydrated(true);
  const sync=(e:StorageEvent)=>{if(e.key===MULTI_KEY&&e.newValue)try{const s=JSON.parse(e.newValue);if(isMultiAccount(s)){current.current=s;setState(s);}}catch{}};
  window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync);
 },[commit]);
 const watchKey=state.positions.map(p=>pairId(p.pair??DEFAULT_PAIR)).sort().join(",");
 useEffect(()=>{setWatchPairs([...new Map(state.positions.map(p=>[pairId(p.pair??DEFAULT_PAIR),p.pair??DEFAULT_PAIR])).values()]);},[watchKey,setWatchPairs]); // eslint-disable-line react-hooks/exhaustive-deps
 const latest=()=>{try{const raw=localStorage.getItem(MULTI_KEY);if(raw){const s=JSON.parse(raw);if(isMultiAccount(s))current.current=s;}}catch{}return current.current;};
 useEffect(()=>{
  if(!hydrated)return;
  let next=current.current;
  for(const f of Object.values(feeds)){if(!f.pair)continue;const r=adoptPair(next,f.pair,f,now());if(r.ok)next=r.state as MultiAccount;}
  if(next!==current.current)commit(next);
 },[feeds,hydrated,now,commit]);
 const run=(p:Pair,action:Parameters<typeof actOnPair>[4]):Result=>{
  if(!hydrated)return {ok:false,error:"Demo account is loading."};
  const before=latest(),feed=feeds[pairId(p)]??null,adopted=adoptPair(before,p,feed,now());
  if(!adopted.ok)return adopted;
  const r=actOnPair(adopted.state as MultiAccount,p,feed,now(),action);commit(r.ok?r.state:adopted.state);return r;
 };
 const open=(side:Side,margin:number,leverage:number)=>run(pair,{kind:"open",side,margin,leverage});
 const close=(id:string):Result=>{const p=latest().positions.find(p=>p.id===id);return p?run(p.pair??DEFAULT_PAIR,{kind:"close",id}):{ok:false,error:"This position is already closed."};};
 return <DemoContext.Provider value={{state,hydrated,storageWarning,legacyPresent,open,close,advance:()=>run(pair,{kind:"funding"}),reset:()=>commit(migrateAccount())}}>{children}</DemoContext.Provider>;
}
export function useDemo(){const value=useContext(DemoContext);if(!value)throw Error("DemoProvider required");return value;}
