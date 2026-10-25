"use client";
import Link from "next/link";
import {useMarket} from "./market-store";
import {StockLogo} from "./market-selector";
import {stock} from "@/lib/catalog";
import {NewsArticleCard,NewsRefresh,NewsStatus,newsTime,useNews} from "./news-feed";
export function PairNews(){
 const {pair}=useMarket();
 return <PairNewsContent key={pair.base+"/"+pair.quote} symbols={[pair.base,pair.quote]}/>;
}
function PairNewsContent({symbols}:{symbols:string[]}){
 const {feeds,loading,failed,refresh}=useNews(symbols);
 return <section id="pair-news" className="odado-panel twun-pair-news" aria-label="News for selected pair">
  <div className="twun-pair-news-heading"><div><span className="odado-kicker">Market context</span><h2>Two stocks. Two news feeds.</h2></div><div><NewsRefresh onClick={refresh} loading={loading}/><Link href="/news">All news ↗</Link></div></div>
  <div className="twun-pair-news-columns">{symbols.map(symbol=>{
   const feed=feeds[symbol];
   return <section key={symbol} aria-label={symbol+" news"}>
    <div className="twun-company-news-title"><StockLogo symbol={symbol}/><div><Link href={"/news?symbol="+encodeURIComponent(symbol)}>{symbol}<span>↗</span></Link><p>{stock(symbol)?.name}</p></div></div>
    <NewsStatus feed={feed} loading={loading} failed={failed}/>
    {feed?.articles.slice(0,3).map(article=><NewsArticleCard compact key={article.id} article={article}/>)}
    {!!feed?.articles.length&&<Link className="twun-company-more" href={"/news?symbol="+encodeURIComponent(symbol)}>More on {symbol} ↗</Link>}
    {feed?.fetchedAt&&<small className="twun-news-checked">Checked {newsTime(feed.fetchedAt)}</small>}
   </section>;
  })}</div>
  <p className="twun-pair-news-foot">Publisher headlines via Finnhub · Links open the original story</p>
 </section>;
}
