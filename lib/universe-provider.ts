import { CatalogStatus, Pair, stock } from "./catalog";
import { Interval } from "./market";
import { marketSession, nyTime } from "./market-calendar";
import { emptyProviderDisk, ProviderDisk, TwelveProvider } from "./twelve-provider";
import { FeedError, normalizeStockHistory, normalizeStockQuote, providerError } from "./twelve-normalize";
import { Bundle, joinHistory, pairFeed, UniverseCache } from "./universe-feed";
export type UniverseDisk = ProviderDisk & { universe?: UniverseCache };
export class UniverseProvider {
  private cache: UniverseCache;
  private transport: TwelveProvider;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private options: {key:string; disk?:UniverseDisk; persist?:(s:UniverseDisk)=>void; now?:()=>number; fetcher?:typeof fetch; dayBudget?:number; minuteBudget?:number; quoteMs?:number}) {
    this.options.disk ??= emptyProviderDisk();
    this.cache = this.options.disk.universe ??= {quotes:{},histories:{},catalog:{},logosChecked:{}};
    this.transport = new TwelveProvider({...options,disk:this.options.disk});
  }
  private now() { return this.options.now?.() ?? Date.now(); }
  private save() { this.options.persist?.(this.options.disk!); }
  private serial<T>(work:()=>Promise<T>):Promise<T> { const result=this.queue.then(work,work); this.queue=result.catch(()=>{});return result; }
  private status(error:unknown) {return error instanceof FeedError?error.status:"partial" as const;}
  private room(cost=1) { const b=this.transport.budget();return this.now()>=b.retryAt && b.minuteUsed+cost<=b.minuteLimit && (b.day!==new Date(this.now()).toISOString().slice(0,10)||b.used+cost<=b.limit); }
  private defer() { const b=this.transport.budget(); return Math.max(b.retryAt,Math.floor(this.now()/60000)*60000+60000); }
  private async quotes(symbols:string[]) {
    const now=this.now(), session=marketSession(now);
    const due=[...new Set(symbols)].filter(s=>!this.cache.quotes[s] || now>=this.cache.quotes[s].nextAt || (session.state==="open" && this.cache.quotes[s].checkedAt<nyTime(session.date,9,30)));
    const budget=this.transport.budget();
    const dailyRemaining=budget.day===new Date(now).toISOString().slice(0,10)?budget.limit-budget.used:budget.limit;
    const eligible=new Set(this.room()?due.slice(0,Math.max(0,Math.min(budget.minuteLimit-budget.minuteUsed,dailyRemaining))):[]);
    for(const exchange of ["NASDAQ","NYSE"] as const) {
      const group=due.filter(s=>stock(s)?.exchange===exchange);
      const chosen=this.room()?group.filter(s=>eligible.has(s)):[];
      for(const s of group.filter(s=>!chosen.includes(s))) {this.cache.quotes[s]={...this.cache.quotes[s],status:"quota_exhausted",checkedAt:this.cache.quotes[s]?.checkedAt??0,nextAt:this.defer()};}
      if(!chosen.length) continue;
      let response:Record<string,unknown>={}, error:unknown;
      try {
        const raw=await this.transport.requestSymbols("quote",chosen,{exchange,interval:"1min",eod:"false"});
        const batch=providerError(raw); response=chosen.length===1 && batch.symbol ? {[chosen[0]]:batch}:batch;
      }catch(e){error=e;}
      for(const s of chosen) {
        try {
          if(error)throw error;
          const value=normalizeStockQuote(response[s],s,this.now());
          this.cache.quotes[s]={value,status:"ready",checkedAt:now,nextAt:session.state==="open"?now+Math.max(120000,this.options.quoteMs??120000):Math.max(now+120000,nyTime(session.date,9,30)>now?nyTime(session.date,9,30):now+6*3600000)};
          (this.cache.catalog[s]??={}).quote={status:"ready",checkedAt:now};
        } catch(e) {
          const status=this.status(e);
          if(status==="quota_exhausted"&&!error)this.transport.recordQuotaFailure(e);
          this.cache.quotes[s]={...this.cache.quotes[s],status,checkedAt:now,nextAt:now+(status==="access_denied"?600000:120000)};
          (this.cache.catalog[s]??={}).quote={status,checkedAt:now};
        }
      }
    }
    this.save();
  }
  private async history(symbol:string, interval:Interval) {
    const key=symbol+":"+interval, old=this.cache.histories[key], now=this.now();
    if(old && now<old.nextAt) return;
    if(!this.room()){this.cache.histories[key]={values:old?.values??[],status:"quota_exhausted",checkedAt:old?.checkedAt??0,nextAt:this.defer()};return;}
    try{
      const raw=await this.transport.requestSymbols("time_series",[symbol],{exchange:stock(symbol)!.exchange,interval,outputsize:interval==="5min"?"1000":"400",adjust:"none",order:"asc"});
      const values=[...normalizeStockHistory(raw,symbol,interval,this.now())].sort((a,b)=>a[0]-b[0]);
      if(values.length<2)throw new FeedError("partial");
      this.cache.histories[key]={values,status:"ready",checkedAt:now,nextAt:now+(interval==="5min"?1800000:21600000)};
      (this.cache.catalog[symbol]??={})[interval==="5min"?"history5min":"history1day"]={status:"ready",checkedAt:now,observations:values.length};
    }catch(e){
      const status=this.status(e);
      this.cache.histories[key]={values:old?.values??[],status,checkedAt:old?.checkedAt??0,nextAt:now+(status==="access_denied"?600000:120000)};
      (this.cache.catalog[symbol]??={})[interval==="5min"?"history5min":"history1day"]={status,checkedAt:now};
    }
    this.save();
  }
  private async logo(symbol:string) {
    if(this.cache.logosChecked[symbol]>this.now() || !this.room())return;
    try{
      const raw=providerError(await this.transport.requestSymbols("logo",[symbol],{exchange:stock(symbol)!.exchange}));
      const meta=raw.meta as {symbol?:string}|undefined;
      if(meta?.symbol!==symbol || typeof raw.url!=="string")throw new FeedError("partial");
      const url=new URL(raw.url);
      if(url.protocol!=="https:" || !["api.twelvedata.com","logo.twelvedata.com"].includes(url.hostname) || url.search)throw new FeedError("partial");
      (this.cache.catalog[symbol]??={}).logo=url.href; this.cache.catalog[symbol].logoStatus="ready";
    }catch(e){(this.cache.catalog[symbol]??={}).logoStatus=this.status(e);}
    this.cache.logosChecked[symbol]=this.now()+(this.cache.catalog[symbol].logoStatus==="ready"?86400000*30:120000);this.save();
  }
  get(pair:Pair, watch:string[], interval:Interval):Promise<Bundle> {return this.serial(async()=>{
    if(this.options.key) {
      // Fresh open-position underlyings first, sorted by oldest check to prevent starvation.
      const active=[...new Set(watch)].sort((a,b)=>(this.cache.quotes[a]?.checkedAt??0)-(this.cache.quotes[b]?.checkedAt??0));
      await this.quotes([...active,pair.base,pair.quote]);
      for(const s of [pair.base,pair.quote])await this.history(s,interval);
    }
    const now=this.now(), market=pairFeed(pair,this.cache.quotes,now,!!this.options.key);
    if(this.options.key)for(const i of ["5min","1day"] as const)market.histories[i]=joinHistory(this.cache.histories[pair.base+":"+i],this.cache.histories[pair.quote+":"+i],i);
    return {market,quotes:this.options.key?this.cache.quotes:{},catalog:this.cache.catalog,budget:this.transport.budget(),serverTime:now};
  });}
  catalog():CatalogStatus { return this.cache.catalog; }
  verify(symbol:string) {return this.serial(async()=>{
    if(!this.options.key)return {status:"not_configured",catalog:this.cache.catalog,budget:this.transport.budget()};
    const needs=(a:{status:string;checkedAt:number}|undefined)=>!a?.checkedAt||["quota_exhausted","unavailable"].includes(a.status);
    if(needs(this.cache.catalog[symbol]?.quote))await this.quotes([symbol]);
    for(const i of ["5min","1day"] as const)if(needs(this.cache.catalog[symbol]?.[i==="5min"?"history5min":"history1day"]))await this.history(symbol,i);
    await this.logo(symbol);
    return {status:"checked",catalog:this.cache.catalog,budget:this.transport.budget()};
  });}
}
