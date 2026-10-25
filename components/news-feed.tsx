"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,MoreHorizontal,Newspaper,Radio,RefreshCw} from "lucide-react";
import type {NewsArticle,NewsFeed} from "@/lib/news";
import {newsCompanies} from "@/lib/news";
import {stock} from "@/lib/catalog";
import {StockLogo} from "./market-selector";

export function useNews(scopes:string[],enabled=true){
 const key=scopes.join(",");
 const [state,setState]=useState<{key:string;feeds:Record<string,NewsFeed>;loading:boolean;failed:boolean}>({key:"",feeds:{},loading:true,failed:false});
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!enabled){setState({key,feeds:{},loading:false,failed:false});return;}
  let active=true,retries=0;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  setState({key,feeds:{},loading:true,failed:false});
  const load=async()=>{
   try{
    const query=key.includes(",")?"symbols="+encodeURIComponent(key):"symbol="+encodeURIComponent(key);
    const response=await fetch("/api/news?"+query,{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error();
    const data=await response.json();if(!data.feeds||key.split(",").some(scope=>data.feeds[scope]?.scope!==scope||!Array.isArray(data.feeds[scope]?.articles)))throw Error();
    if(active){setState({key,feeds:data.feeds,loading:false,failed:false});const busy=Object.values(data.feeds).some(f=>(f as NewsFeed).status==="refreshing");timer=setTimeout(()=>void load(),busy&&retries++<3?2500:60000);}
   }catch{if(active){setState({key,feeds:{},loading:false,failed:true});timer=setTimeout(()=>void load(),60000);}}
  };
  void load();return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[key,attempt,enabled]);
 return {feeds:state.key===key?state.feeds:{},loading:state.key!==key||state.loading,failed:state.key===key&&state.failed,refresh:()=>setAttempt(v=>v+1)};
}
export function newsTime(timestamp:number){return new Date(timestamp).toLocaleString("en-US",{timeZone:"UTC",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC";}
function RelatedStocks({article}:{article:NewsArticle}){
 const companies=newsCompanies(article);
 return <div className="twun-news-related" role="group" aria-label="Related stocks">
  <span className="twun-news-related-label">Related stocks</span>
  {companies.length?<div className="twun-news-stock-list">{companies.slice(0,5).map(({symbol,basis})=><Link key={symbol} href={"/trade?create="+encodeURIComponent(symbol)} className="twun-news-stock" aria-label={"Create a pair with "+stock(symbol)!.name+" ("+symbol+")"} title={"Create a pair · "+stock(symbol)!.name+" · "+symbol+" · "+(basis==="source"?"Linked by the news source":"Mentioned in the headline or summary")}><StockLogo symbol={symbol}/></Link>)}
   {companies.length>5&&<details className="twun-news-stock-overflow"><summary aria-label={`Show ${companies.length-5} more related stocks`} title="More related stocks"><MoreHorizontal size={18}/></summary><div className="twun-news-stock-popover"><p>Also in this story</p>{companies.slice(5).map(({symbol})=><Link key={symbol} href={"/trade?create="+encodeURIComponent(symbol)} aria-label={"Create a pair with "+stock(symbol)!.name+" ("+symbol+")"}><StockLogo symbol={symbol}/><span>{stock(symbol)!.name}<small>{symbol}</small></span></Link>)}</div></details>}
  </div>:<span className="twun-news-unlinked">No specific company identified</span>}
 </div>;
}
export function NewsArticleCard({article,compact=false,lead=false}:{article:NewsArticle;compact?:boolean;lead?:boolean}){
 return <article className={"twun-news-article"+(compact?" is-compact":"")+(lead?" is-lead":"")}>
  <div className="twun-news-meta"><span>{article.source}</span><time dateTime={new Date(article.publishedAt).toISOString()}>{newsTime(article.publishedAt)}</time></div>
  <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.headline}<ArrowUpRight size={compact?14:18}/></a></h3>
  {!compact&&article.summary&&<p className="twun-news-summary">{article.summary}</p>}
  <RelatedStocks article={article}/>
 </article>;
}
export function NewsStatus({feed,loading,failed}:{feed?:NewsFeed;loading?:boolean;failed?:boolean}){
 if(loading)return <div className="twun-news-empty" role="status"><Radio size={24}/><h3>Gathering the headlines…</h3><p>Looking up the latest publisher coverage.</p></div>;
 if(feed?.articles.length)return feed.status!=="ready"||feed.stale?<div className="twun-news-alert" role="status">{feed.coverage&&feed.status==="unavailable"?"Some company updates are unavailable":"Updates paused"} · Showing cached headlines{feed.fetchedAt?" · Latest feed check "+newsTime(feed.fetchedAt):""}.</div>:null;
 const title=failed?"News is temporarily unavailable":feed?.status==="ready"?"No recent headlines":feed?.message??"News is temporarily unavailable";
 const description=feed?.status==="not_configured"?"Publisher coverage will appear here when the news service is connected.":feed?.status==="ready"?"No matching stories were returned for the last seven days.":feed?.status==="refreshing"?"Another update is in progress. This feed will refresh shortly.":"We’ll check again shortly. Market prices and trading remain separate from this feed.";
 return <div className="twun-news-empty" role="status"><Newspaper size={26}/><h3>{title}</h3><p>{description}</p></div>;
}
export function NewsRefresh({onClick,loading=false}:{onClick:()=>void;loading?:boolean}){return <button type="button" className="twun-news-refresh" onClick={onClick} disabled={loading} aria-label="Refresh news"><RefreshCw size={13}/>Refresh</button>;}
