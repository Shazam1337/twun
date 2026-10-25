import { STOCKS } from "./catalog";
import { marketSession,nyDate,nyTime } from "./market-calendar";
import { MAX_AGE_MS } from "./market";
import type { UniverseCache } from "./universe-feed";

export type TickerItem = { symbol:string; name:string; price:number|null; timestamp:number|null; change24h:number|null; referenceTime:number|null; status:string };
export type TickerFeed = { items:TickerItem[]; serverTime:number; configured:boolean; session:string; refresh?:{state:string;used:number;limit:number;nextAt:number} };
/** Most recent scheduled close, with holidays, half-days and NY DST respected. */
export function lastRegularClose(now:number){
 const date=Date.parse(nyDate(now)+"T12:00:00Z");
 for(let i=0;i<10;i++){const day=new Date(date-i*86400000).toISOString().slice(0,10),s=marketSession(nyTime(day,10));if(s.state==="open"&&s.closesAt<=now)return s.closesAt;}
 return null;
}
/** Cache-only display. Never changes marks or spends additional provider credits. */
export function stockTicker(cache:UniverseCache, now:number, configured:boolean):TickerFeed {
 const session=marketSession(now);
 const lastClose=session.state==="closed"?lastRegularClose(now):null;
 return {serverTime:now,configured,session:session.state,items:STOCKS.map(s=>{
  const cached=cache.quotes[s.symbol],q=configured?cached?.value:undefined;
  const valid=q?.symbol===s.symbol&&q.currency==="USD"&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(q.timestamp)&&q.timestamp>=Date.UTC(2000,0,1)&&q.timestamp<=now+10000;
  const row:TickerItem={symbol:s.symbol,name:s.name,price:valid?q!.price:null,timestamp:valid?q!.timestamp:null,change24h:null,referenceTime:null,status:!configured?"not_configured":!valid?"unavailable":cached.status};
  if(!valid)return row;
  const timely=session.state==="open"?now-q!.timestamp<=MAX_AGE_MS&&q!.marketOpen:session.state==="closed"&&lastClose!==null&&q!.timestamp>=lastClose-MAX_AGE_MS&&q!.timestamp<=lastClose+10000;
  if(row.status==="ready"&&!timely)row.status="cached";
  // Keep old prices dated, but never present their historical percentage as today's 24h move.
  if(row.status!=="ready")return row;
  // Intraday timestamps mark the START of each 5m bar. Use a completed close
  // at/before quote time minus 24h, at most 5m away. No weekend substitution,
  // interpolation, daily-percent fallback, or previous-minute quote.change.
  const target=q!.timestamp-86400000,h=cache.histories[s.symbol+":5min"];
  const reference=h?.status==="ready"?h.values.filter(([t,p])=>Number.isFinite(t)&&Number.isFinite(p)&&p>0&&t+300000<=target&&target-(t+300000)<300000).sort((a,b)=>b[0]-a[0])[0]:undefined;
  if(reference){const change=(q!.price/reference[1]-1)*100;if(Number.isFinite(change)){row.change24h=change;row.referenceTime=reference[0]+300000;}}
  return row;
 })};
}
