import { CatalogStatus, Pair, stock, STOCKS } from "./catalog";
import { Interval } from "./market";
import { marketSession, nyTime } from "./market-calendar";
import { emptyProviderDisk, ProviderDisk, TwelveProvider } from "./twelve-provider";
import { FeedError, normalizeStockHistory, normalizeStockQuote, providerError } from "./twelve-normalize";
import { Bundle,HistoryPage, joinHistory, pairFeed, UniverseCache } from "./universe-feed";
import { stockTicker,lastRegularClose } from "./stock-ticker";
export type UniverseDisk = ProviderDisk & { universe?: UniverseCache; tickerRefresh?:{day:string;used:number;nextAt:number} };
export class UniverseProvider {
  private cache: UniverseCache;
  private transport: TwelveProvider;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private options: {key:string; disk?:UniverseDisk; persist?:(s:UniverseDisk)=>void|Promise<void>; now?:()=>number; fetcher?:typeof fetch; dayBudget?:number; minuteBudget?:number; quoteMs?:number; tickerDayBudget?:number}) {
    this.options.disk ??= emptyProviderDisk();
    this.cache = this.options.disk.universe ??= {quotes:{},histories:{},catalog:{},logosChecked:{}};
    this.transport = new TwelveProvider({...options,disk:this.options.disk});
  }
  private now() { return this.options.now?.() ?? Date.now(); }
  private async save() { await this.options.persist?.(this.options.disk!); }
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
          if(status==="quota_exhausted"&&!error)await this.transport.recordQuotaFailure(e);
          this.cache.quotes[s]={...this.cache.quotes[s],status,checkedAt:now,nextAt:now+(status==="access_denied"?600000:120000)};
          (this.cache.catalog[s]??={}).quote={status,checkedAt:now};
        }
      }
    }
    await this.save();
  }
  private async history(symbol:string, interval:Interval,historySeconds=300) {
    const key=symbol+":"+interval, old=this.cache.histories[key], now=this.now();
    const ttl=interval!=="1day"?Math.max(300,Math.min(3600,historySeconds))*1000:21600000;
    if(old && now<(old.status==="ready"?old.checkedAt+ttl:old.nextAt)) return;
    if(!this.room()){this.cache.histories[key]={values:old?.values??[],status:"quota_exhausted",checkedAt:old?.checkedAt??0,nextAt:this.defer()};return;}
    try{
      const raw=await this.transport.requestSymbols("time_series",[symbol],{exchange:stock(symbol)!.exchange,interval,outputsize:interval==="1min"?"5000":interval==="5min"?"1000":"400",adjust:"none",order:"asc"});
      const values=[...normalizeStockHistory(raw,symbol,interval,this.now())].sort((a,b)=>a[0]-b[0]);
      if(values.length<2)throw new FeedError("partial");
      this.cache.histories[key]={values,status:"ready",checkedAt:now,nextAt:now+ttl};
      (this.cache.catalog[symbol]??={})[interval==="1min"?"history1min":interval==="5min"?"history5min":"history1day"]={status:"ready",checkedAt:now,observations:values.length};
    }catch(e){
      const status=this.status(e);
      this.cache.histories[key]={values:old?.values??[],status,checkedAt:old?.checkedAt??0,nextAt:now+(status==="access_denied"?600000:120000)};
      (this.cache.catalog[symbol]??={})[interval==="1min"?"history1min":interval==="5min"?"history5min":"history1day"]={status,checkedAt:now};
    }
    await this.save();
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
    this.cache.logosChecked[symbol]=this.now()+(this.cache.catalog[symbol].logoStatus==="ready"?86400000*30:120000);await this.save();
  }
  get(pair:Pair, watch:string[], interval:Interval,historySeconds=300):Promise<Bundle> {return this.serial(async()=>{
    if(this.options.key) {
      // Fresh open-position underlyings first, sorted by oldest check to prevent starvation.
      const active=[...new Set(watch)].sort((a,b)=>(this.cache.quotes[a]?.checkedAt??0)-(this.cache.quotes[b]?.checkedAt??0));
      await this.quotes([...active,pair.base,pair.quote]);
      for(const s of [pair.base,pair.quote])await this.history(s,interval,historySeconds);
    }
    return this.snapshot(pair,interval);
  });}
  /** Read committed data without scheduling upstream work (other instance owns refresh). */
  analyticsSnapshot(pair:Pair){return {pair,configured:!!this.options.key,series:[pair.base,pair.quote].map(symbol=>({symbol,...(this.cache.histories[symbol+":1day"]??{values:[],status:!this.options.key?"not_configured" as const:"unavailable" as const,checkedAt:0,nextAt:0})})),budget:this.transport.budget(),serverTime:this.now()};}
  analytics(pair:Pair){return this.serial(async()=>{if(this.options.key)for(const symbol of [pair.base,pair.quote])await this.history(symbol,"1day");return this.analyticsSnapshot(pair);});}
  historyPageSnapshot(pair:Pair,before:number):HistoryPage {
    const a=this.cache.histories[`${pair.base}:1min:before:${before}`],b=this.cache.histories[`${pair.quote}:1min:before:${before}`];
    const status=!this.options.key?"not_configured":a?.status!=="ready"?a?.status??"unavailable":b?.status??"unavailable";
    const empty=a?.status==="ready"&&b?.status==="ready"&&(!a.values.length||!b.values.length);
    const history=empty?null:joinHistory(a,b,"1min");
    return {pair,before,history,status:status==="ready"&&history?history.status:status,hasMore:status==="ready"&&!empty,retryAt:Math.max(a?.status!=="ready"?a?.nextAt??0:0,b?.status!=="ready"?b?.nextAt??0:0,this.transport.budget().retryAt)};
  }
  historyPage(pair:Pair,before:number):Promise<HistoryPage>{return this.serial(async()=>{
    if(!this.options.key)return this.historyPageSnapshot(pair,before);
    for(const symbol of [pair.base,pair.quote]){
      const key=`${symbol}:1min:before:${before}`,old=this.cache.histories[key],now=this.now();
      if(old&&now<old.nextAt)continue;
      if(!this.room()){this.cache.histories[key]={values:old?.values??[],status:"quota_exhausted",checkedAt:old?.checkedAt??0,nextAt:this.defer()};await this.save();continue;}
      try{
        const raw=await this.transport.requestSymbols("time_series",[symbol],{exchange:stock(symbol)!.exchange,interval:"1min",outputsize:"5000",adjust:"none",order:"asc",end_date:new Date(before-60000).toISOString().slice(0,19).replace("T"," ")});
        const values=[...normalizeStockHistory(raw,symbol,"1min",this.now(),true)].filter(([t])=>t<before).sort((a,b)=>a[0]-b[0]);
        // A nonempty response ignoring the cursor is invalid, not evidence of history ending.
        if((raw as {values?:unknown[]}).values?.length&&!values.length)throw new FeedError("partial");
        this.cache.histories[key]={values,status:"ready",checkedAt:now,nextAt:now+86400000};
      }catch(error){const status=this.status(error);this.cache.histories[key]={values:old?.values??[],status,checkedAt:old?.checkedAt??0,nextAt:now+(status==="access_denied"?600000:120000)};}
      // Bounded historical page cache, separate from latest bars and quote state.
      const pages=Object.entries(this.cache.histories).filter(([k])=>k.includes(":before:")).reverse().sort((a,b)=>b[1].checkedAt-a[1].checkedAt);
      for(const [k] of pages.slice(64))delete this.cache.histories[k];
      await this.save();
    }
    return this.historyPageSnapshot(pair,before);
  });}

  snapshot(pair:Pair, interval:Interval):Bundle {
    const now=this.now(), market=pairFeed(pair,this.cache.quotes,now,!!this.options.key);
    if(this.options.key)for(const i of ["1min","5min","1day"] as const)market.histories[i]=joinHistory(this.cache.histories[pair.base+":"+i],this.cache.histories[pair.quote+":"+i],i);
    return {market,quotes:this.options.key?this.cache.quotes:{},catalog:this.cache.catalog,budget:this.transport.budget(),serverTime:now};
  }
  catalog():CatalogStatus { return this.cache.catalog; }
  ticker() { return stockTicker(this.cache,this.now(),!!this.options.key); }
  /** Demand-driven, shared low-priority catalog rotation. One upstream request per batch. */
  refreshTicker(){return this.serial(async()=>{
    const now=this.now(),day=new Date(now).toISOString().slice(0,10),session=marketSession(now),budget=this.transport.budget();
    const limit=Math.max(0,Math.min(this.options.tickerDayBudget??180,budget.limit));
    const previous=this.options.disk!.tickerRefresh;
    if(previous&&(!/^\d{4}-\d{2}-\d{2}$/.test(previous.day)||!Number.isSafeInteger(previous.used)||previous.used<0||!Number.isFinite(previous.nextAt)))throw new FeedError("unavailable");
    const journal=previous?.day===day?previous:{day,used:0,nextAt:0};
    const dailyUsed=budget.day===day?budget.used:0;
    let state=!this.options.key?"not_configured":journal.used>=limit?"budget_limited":now<budget.retryAt?"backoff":session.state==="unknown"?"paused":"rotating";
    if(state==="rotating"&&now>=journal.nextAt){
      // Quotes are refreshed oldest-first; a failure advances checkedAt and honors nextAt.
      const close=session.state==="closed"?lastRegularClose(now):null;
      const due=STOCKS.filter(s=>{
        const q=this.cache.quotes[s.symbol];if(!q)return true;
        if(close&&q.status==="ready"&&q.value&&q.value.timestamp>=close-300000&&q.value.timestamp<=close+10000)return false;
        return now>=q.nextAt&&now>=q.checkedAt+(q.status==="ready"?(session.state==="open"?3600000:21600000):0);
      }).sort((a,b)=>(this.cache.quotes[a.symbol]?.checkedAt??0)-(this.cache.quotes[b.symbol]?.checkedAt??0));
      const first=due[0];
      const quoteSymbols=first?due.filter(s=>s.exchange===first.exchange).slice(0,Math.min(2,limit-journal.used)).map(s=>s.symbol):[];
      const historySymbol=!first?STOCKS.filter(s=>{
        const q=this.cache.quotes[s.symbol]?.value,h=this.cache.histories[s.symbol+":5min"];
        // Do not spend history credits on a months-old or invalid quote.
        return q&&Number.isFinite(q.price)&&q.price>0&&q.timestamp>=now-4*86400000&&(!h||now>=(h.status==="ready"?h.checkedAt+21600000:h.nextAt));
      }).sort((a,b)=>(this.cache.histories[a.symbol+":5min"]?.checkedAt??0)-(this.cache.histories[b.symbol+":5min"]?.checkedAt??0))[0]?.symbol:undefined;
      const cost=quoteSymbols.length||(historySymbol?1:0),minuteReserve=Math.min(4,Math.max(0,budget.minuteLimit-2)),dayReserve=Math.min(40,Math.floor(budget.limit*.1));
      if(cost&&journal.used+cost<=limit&&this.room(cost)&&budget.minuteLimit-budget.minuteUsed-cost>=minuteReserve&&budget.limit-dailyUsed-cost>=dayReserve){
        this.options.disk!.tickerRefresh={day,used:journal.used+cost,nextAt:Math.floor(now/60000)*60000+60000};
        // Persist the catalog allowance BEFORE upstream; failed calls and restarts count too.
        await this.save();
        if(quoteSymbols.length)await this.quotes(quoteSymbols);else if(historySymbol)await this.history(historySymbol,"5min",3600);
      }else if(cost)state="budget_limited";
    }
    const feed=this.ticker(),latest=this.options.disk!.tickerRefresh;
    if(this.options.key&&now<this.transport.budget().retryAt)state="backoff";
    else if(this.options.key&&latest?.day===day&&latest.used>=limit)state="budget_limited";
    return {...feed,refresh:{state,used:latest?.day===day?latest.used:0,limit,nextAt:Math.max(latest?.nextAt??0,this.transport.budget().retryAt)}};
  });}
  verify(symbol:string) {return this.serial(async()=>{
    if(!this.options.key)return {status:"not_configured",catalog:this.cache.catalog,budget:this.transport.budget()};
    const needs=(a:{status:string;checkedAt:number}|undefined)=>!a?.checkedAt||["quota_exhausted","unavailable"].includes(a.status);
    if(needs(this.cache.catalog[symbol]?.quote))await this.quotes([symbol]);
    for(const i of ["5min","1day"] as const)if(needs(this.cache.catalog[symbol]?.[i==="5min"?"history5min":"history1day"]))await this.history(symbol,i);
    await this.logo(symbol);
    return {status:"checked",catalog:this.cache.catalog,budget:this.transport.budget()};
  });}
}
