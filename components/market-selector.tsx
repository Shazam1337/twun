"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDownUp,ArrowRight,Check,ChevronDown,Search,Star,X,Plus} from "lucide-react";
import {canonicalPair,DEFAULT_PAIR,Pair,pairId,parsePair,PRESETS,stock,STOCKS,validPair} from "@/lib/catalog";
import {useMarket} from "./market-store";
export function StockLogo({symbol}:{symbol:string}){
 const {catalog}=useMarket(),[failed,setFailed]=useState(false),url=catalog[symbol]?.logo;
 return <span className="odado-company-logo" aria-hidden="true">{url&&!failed?<img src={url} alt="" width={32} height={32} loading="lazy" onError={()=>setFailed(true)}/>:<span>{symbol.slice(0,2)}</span>}</span>;
}
export function PairLogos({pair}:{pair:Pair}){return <span className="odado-pair-logos"><StockLogo symbol={pair.base}/><StockLogo symbol={pair.quote}/></span>;}
export function MarketSelector(){
 const {pair,selectPair,catalog}=useMarket();
 const [open,setOpen]=useState(false),[tab,setTab]=useState<"markets"|"create"|"favorites">("markets"),[search,setSearch]=useState("");
 const [draft,setDraft]=useState<Pair>(DEFAULT_PAIR),[field,setField]=useState<"base"|"quote">("base"),[favorites,setFavorites]=useState<string[]>([]),[created,setCreated]=useState<Pair[]>([]);
 const dialog=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{try{const f=JSON.parse(localStorage.getItem("odado-favorites")??"[]"),c=JSON.parse(localStorage.getItem("odado-created-pairs")??"[]");if(Array.isArray(f))setFavorites(f.filter((id:unknown)=>typeof id==="string"&&parsePair(id)).map((id:string)=>canonicalPair(parsePair(id)!)));if(Array.isArray(c))setCreated(c.filter(validPair));}catch{}},[]);
 useEffect(()=>{if(!open)return;const before=document.body.style.overflow;document.body.style.overflow="hidden";dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
 const keys=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);if(e.key==="Tab"){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 document.addEventListener("keydown",keys);return()=>{document.body.style.overflow=before;document.removeEventListener("keydown",keys);trigger.current?.focus();};
 },[open]);
 const favorite=(p:Pair)=>{const id=canonicalPair(p),next=favorites.includes(id)?favorites.filter(s=>s!==id):[...favorites,id];setFavorites(next);try{localStorage.setItem("odado-favorites",JSON.stringify(next));}catch{}};
 const choose=(p:Pair)=>{selectPair(p);setOpen(false);};
 const create=()=>{if(!validPair(draft))return;const next=[...created.filter(p=>canonicalPair(p)!==canonicalPair(draft)),draft];setCreated(next);try{localStorage.setItem("odado-created-pairs",JSON.stringify(next));}catch{}choose(draft);};
 const unique=new Map<string,Pair>();
 for(const p of [...created,...PRESETS,...favorites.map(id=>parsePair(id)!)])if(!unique.has(canonicalPair(p)))unique.set(canonicalPair(p),p);
 const all=[...unique.values()];
 const query=search.trim().toLowerCase(),matches=(p:Pair)=>[p.base,p.quote,stock(p.base)!.name,stock(p.quote)!.name].some(s=>s.toLowerCase().includes(query));
 const markets=all.filter(p=>matches(p)&&(tab!=="favorites"||favorites.includes(canonicalPair(p))));
 const stocks=STOCKS.filter(s=>(s.symbol+" "+s.name).toLowerCase().includes(query));
 const ready=Object.values(catalog).filter(s=>s.quote?.status==="ready"&&s.history1day?.status==="ready"&&s.history5min?.status==="ready").length;
 return <div className="odado-pair-picker">
  <button ref={trigger} className="odado-pair-button" aria-label="Choose market" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setDraft(pair);setSearch("");setOpen(true);}}><PairLogos pair={pair}/><span><span className="odado-pair-name">{pair.base} / {pair.quote}</span><span className="odado-pair-subtitle">Synthetic perpetual · Isolated</span></span><ChevronDown size={16}/></button>
  <button className="odado-swap-pair" aria-label="Reverse pair" title="Reverse the selected ratio; existing positions stay unchanged" onClick={()=>selectPair({base:pair.quote,quote:pair.base})}><ArrowDownUp size={16}/></button>
  {open&&<div className="odado-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><div ref={dialog} role="dialog" aria-modal="true" aria-label="Choose a stock pair" className="odado-market-selector">
   <div className="odado-selector-heading"><div><p className="odado-kicker">THE RELATIVE PERFORMANCE MARKET</p><h2>Find your perspective.</h2><p>50 stocks. Any two. One ratio.</p></div><button aria-label="Close market selector" onClick={()=>setOpen(false)}><X size={21}/></button></div>
   <div className="odado-selector-tabs">{(["markets","favorites","create"] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setSearch("");}}>{t==="markets"?"Explore pairs":t==="favorites"?<><Star size={14}/>Favorites</>:<><Plus size={14}/>Create pair</>}</button>)}</div>
   {tab==="create"&&<div className="odado-create-inputs"><button aria-label="Choose first stock" className={field==="base"?"is-active":""} onClick={()=>{setField("base");setSearch("");}}><small>First stock</small><span><StockLogo symbol={draft.base}/><strong>{draft.base}</strong></span></button><button className="odado-draft-swap" aria-label="Reverse draft pair" onClick={()=>setDraft({base:draft.quote,quote:draft.base})}><ArrowDownUp size={18}/></button><button aria-label="Choose second stock" className={field==="quote"?"is-active":""} onClick={()=>{setField("quote");setSearch("");}}><small>Second stock</small><span><StockLogo symbol={draft.quote}/><strong>{draft.quote}</strong></span></button></div>}
   <label className="odado-selector-search"><Search size={18}/><input aria-label="Search stocks and pairs" placeholder={tab==="create"?"Search 50 stocks by name or ticker":"Search ticker or company"} value={search} onChange={e=>setSearch(e.target.value)}/><span>{tab==="create"?"50 stocks":markets.length+" pairs"}</span></label>
   <div className="odado-selector-results">
   {tab==="create"?<div className="odado-stock-list">{stocks.map(s=>{const a=catalog[s.symbol],other=draft[field==="base"?"quote":"base"],checked=a?.quote?.status==="ready"&&a?.history1day?.status==="ready"&&a?.history5min?.status==="ready";return <button key={s.symbol} disabled={s.symbol===other} onClick={()=>{setDraft({...draft,[field]:s.symbol});if(field==="base")setField("quote");setSearch("");}}><StockLogo symbol={s.symbol}/><span><strong>{s.symbol}<small>{s.sector}</small></strong><span>{s.name}</span></span><small>{s.symbol===other?"Already selected":checked?"Quote + history verified":a?.quote?.status==="access_denied"?"Plan restriction":"Availability not verified"}</small>{draft[field]===s.symbol&&<Check size={16}/>}</button>;})}{!stocks.length&&<p className="odado-selector-empty">No stocks match your search.</p>}</div>:<div className="odado-preset-grid">{markets.map(p=><div key={canonicalPair(p)} className={canonicalPair(p)===canonicalPair(pair)?"is-selected":""}><button className="odado-preset-main" onClick={()=>choose(p)}><PairLogos pair={p}/><strong>{p.base} / {p.quote}</strong><span>{stock(p.base)!.name} / {stock(p.quote)!.name}</span><small>Synthetic ratio · 1–10x <ArrowRight size={13}/></small></button><button className="odado-favorite" aria-label={`${favorites.includes(canonicalPair(p))?"Remove":"Add"} ${pairId(p)} ${favorites.includes(canonicalPair(p))?"from":"to"} favorites`} aria-pressed={favorites.includes(canonicalPair(p))} onClick={()=>favorite(p)}><Star size={16} fill={favorites.includes(canonicalPair(p))?"currentColor":"none"}/></button></div>)}{!markets.length&&<p className="odado-selector-empty">{tab==="favorites"?"Star a pair to keep it here.":"No preset matches. Create your own pair from the catalog."}</p>}</div>}
   </div>
   <div className="odado-selector-footer">{tab==="create"?<><p>Index = {draft.base} ÷ {draft.quote}<small>Long rises with the ratio. Short falls with it.</small></p><button className="odado-create-button" disabled={!validPair(draft)} onClick={create}>Trade this pair <ArrowRight size={16}/></button></>:<><p>Curated selection, not a market-cap ranking.<small>{ready}/50 verified for quotes and both history intervals.</small></p><button onClick={()=>{setTab("create");setSearch("");}}>Create a pair <Plus size={16}/></button></>}</div>
   <p className="odado-selector-disclaimer">Odado synthetic markets · Demo trading · No stock ownership</p>
  </div></div>}
 </div>;
}
