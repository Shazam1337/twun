"use client";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {ArrowUpRight,Search,SlidersHorizontal} from "lucide-react";
import {STOCKS,stock} from "@/lib/catalog";
import {useMarket} from "./market-store";
import {NewsArticleCard,NewsRefresh,NewsStatus,newsTime,useNews} from "./news-feed";
import {filterNews,type NewsFilters} from "@/lib/news";

export function NewsRoom(){
 const params=useSearchParams(),router=useRouter(),{pair}=useMarket();
 const requested=params.get("symbol")??"",symbol=stock(requested)?requested:"",scope=symbol||"market";
 const {feeds,loading,failed,refresh}=useNews([scope]),feed=feeds[scope];
 const [search,setSearch]=useState(""),[relatedOnly,setRelatedOnly]=useState(false),[source,setSource]=useState(""),[period,setPeriod]=useState<NewsFilters["period"]>("all");
 const [filtersOpen,setFiltersOpen]=useState(false),filterButton=useRef<HTMLButtonElement>(null);
 const filterCount=Number(relatedOnly)+Number(!!source)+Number(period!=="all")+Number(!!symbol);
 const loaded=feed?.articles??[],sources=[...new Set([...loaded.map(a=>a.source),...(source?[source]:[])])].sort();
 const articles=filterNews(loaded,{search,relatedOnly,source,period},Date.now()),active=!!(search.trim()||relatedOnly||source||period!=="all"||symbol);
 const pageKey=JSON.stringify([scope,search.trim().toLowerCase(),relatedOnly,source,period]);
 const [pagination,setPagination]=useState({key:"",count:20});
 useEffect(()=>setPagination({key:pageKey,count:20}),[pageKey]);
 const shown=Math.min(articles.length,pagination.key===pageKey?pagination.count:20);
 const reset=()=>{setSearch("");setRelatedOnly(false);setSource("");setPeriod("all");if(symbol)router.replace("/news",{scroll:false});};
 const choose=(s:string)=>{setSearch("");router.replace(s?"/news?symbol="+encodeURIComponent(s):"/news",{scroll:false});};
 return <main className="twun-news-page">
  <div className="twun-news-page-heading"><div><p className="odado-kicker">Newsroom / Stock performance</p><h1>The market,<br/><span>in context.</span></h1></div><p>Follow the stories behind the stocks.<br/>Market headlines and company coverage,<br/>all in one place.</p></div>
  <div className="twun-news-layout"><div className="twun-news-main">
   <div className="twun-news-tools"><label className="twun-news-search"><Search size={17}/><input type="search" aria-label="Search news" placeholder="Search headlines or companies" value={search} onChange={e=>setSearch(e.target.value)}/></label><button ref={filterButton} type="button" className="twun-news-filter-toggle" aria-label="Filters" aria-expanded={filtersOpen} aria-controls="news-advanced-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15}/>Filters{!!filterCount&&<span>{filterCount}</span>}</button></div>
   {filtersOpen&&<div id="news-advanced-filters" className="twun-news-filters" role="group" aria-label="News filters" onKeyDown={e=>{if(e.key==="Escape"){setFiltersOpen(false);filterButton.current?.focus();}}}>
    <label><span>Coverage</span><select aria-label="News coverage" value={symbol} onChange={e=>choose(e.target.value)}><option value="">Market overview</option>{STOCKS.map(s=><option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>)}</select></label>
    <button type="button" className="twun-news-related-filter" aria-pressed={relatedOnly} onClick={()=>setRelatedOnly(!relatedOnly)}>Has related stocks</button>
    <label><span>Published</span><select aria-label="Publication period" value={period} onChange={e=>setPeriod(e.target.value as NewsFilters["period"])}><option value="all">Any time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label>
    <label><span>Publisher</span><select aria-label="News publisher" value={source} onChange={e=>setSource(e.target.value)}><option value="">All publishers</option>{sources.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    {active&&<button type="button" className="twun-news-filter-reset" onClick={reset}>Clear filters</button>}
    {!!loaded.length&&<small className="twun-news-filter-count" role="status">{articles.length} of {loaded.length} loaded stories</small>}
   </div>}
   <section className="twun-news-stream" aria-label="News headlines"><div className="twun-news-stream-heading"><div><span className="odado-kicker">{symbol?"Company coverage":"Market brief"}</span><h2>{symbol?stock(symbol)!.name:"Latest headlines"}{symbol&&<small>{symbol}</small>}</h2></div><NewsRefresh loading={loading} onClick={refresh}/></div>
    <NewsStatus feed={feed} loading={loading} failed={failed}/>
    {feed?.coverage&&<p className="twun-news-catalog-coverage">Company news · {feed.coverage.checked}/{feed.coverage.total} company feeds checked<small>Rolling coverage of our stock catalog. Feeds update progressively, not all at once.</small></p>}
    {articles.slice(0,shown).map((article,i)=><NewsArticleCard key={article.id} article={article} lead={i===0}/>)}
    {!!articles.length&&<div className="twun-news-pagination"><p role="status">Showing {shown} of {articles.length} {active?"matching ":""}stories</p>{shown<articles.length&&<button type="button" onClick={()=>setPagination({key:pageKey,count:shown+20})}>Load more <span>+{Math.min(20,articles.length-shown)}</span></button>}</div>}
    {!!feed?.articles.length&&!articles.length&&<div className="twun-news-empty"><h3>No matching headlines</h3><p>Try different filters, another word or a different company.</p><button type="button" className="twun-news-filter-reset" onClick={reset}>Clear filters</button></div>}
    {feed?.fetchedAt&&<p className="twun-news-checked">Feed checked {newsTime(feed.fetchedAt)} · Publisher timestamps shown in UTC</p>}
   </section>
  </div><aside className="twun-news-sidebar">
   <section className="twun-news-pair-card"><p className="odado-kicker">Your selected market</p><h2>{pair.base}<span>/</span>{pair.quote}</h2><p>Read both sides of your pair before you take a position.</p><Link href="/trade#pair-news">News in the terminal<ArrowUpRight size={16}/></Link></section>
   <section className="twun-news-watch"><p className="odado-kicker">In focus</p><h2>Follow a company.</h2><div>{["NVDA","TSLA","AAPL","MSFT","AMZN","GOOGL"].map(s=><button type="button" key={s} aria-pressed={symbol===s} onClick={()=>choose(s)}><b>{s}</b><span>{stock(s)?.name}</span><ArrowUpRight size={13}/></button>)}</div><button type="button" className="twun-news-market-link" onClick={()=>choose("")}>Back to market overview ↗</button></section>
   <p className="twun-news-source-note">News via Finnhub. Each story links to its original publisher. Coverage can vary by company and provider availability.</p>
  </aside></div>
 </main>;
}
