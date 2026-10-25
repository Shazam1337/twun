import type {MarketStorage} from "./market-storage";
import type {UniverseDisk} from "./universe-provider";
import {emptyNews,mergeCompanyNews,NEWS_MESSAGES,normalizeNews,NewsFeed,NewsStatus} from "./news";
import {STOCKS} from "./catalog";
import {normalizeProfile,ProfileFeed,ProfileEntry,profileOrder,profileCoverage} from "./company-profile";
type Entry={articles:NewsFeed["articles"];fetchedAt:number;status:NewsStatus;nextAt:number;attemptedAt?:number};
type NewsDisk=UniverseDisk&{news?:Record<string,Entry>;newsCatalogNext?:number;profiles?:Record<string,ProfileEntry>;profileNext?:number;profileMinute?:number;profileMinuteUsed?:number};
class NewsError extends Error{constructor(public status:NewsStatus,public retryMs=0){super(status);}}
export class NewsProvider{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private options:{key:string;storage:MarketStorage;fetcher?:typeof fetch;now?:()=>number;ttlMs?:number;dayBudget?:number;minuteBudget?:number;catalogTtlMs?:number}){}
 private now(){return this.options.now?.()??Date.now();}
 profiles(priority:string[]=[]):Promise<ProfileFeed>{const task=this.queue.then(()=>this.refreshProfiles(priority));this.queue=task.catch(()=>{});return task;}
 private async refreshProfiles(priority:string[]):Promise<ProfileFeed>{
  const minuteLimit=this.options.minuteBudget??10,profileLimit=Math.max(1,minuteLimit-Math.min(2,Math.floor(minuteLimit/3)));
  const output=(d:NewsDisk,status:NewsStatus):ProfileFeed=>{const now=this.now(),day=new Date(now).toISOString().slice(0,10),coverage=profileCoverage(d.profiles??{},STOCKS.map(s=>s.symbol),now);return {provider:"Finnhub",entries:d.profiles??{},status,retryAt:Math.max(d.profileNext??0,d.blockedUntil??0,d.day===day&&d.used>=(this.options.dayBudget??500)?Date.parse(day)+86400000:0),serverTime:now,budget:{used:d.day===day?d.used:0,limit:this.options.dayBudget??500,minuteUsed:d.minute===Math.floor(now/60000)?d.minuteUsed:0,minuteLimit},coverage:{available:coverage.available,fresh:coverage.fresh,total:50},batch:{limit:3,minuteLimit:profileLimit}};};
  if(!this.options.key)return output({} as NewsDisk,"not_configured");
  try{const lease=await this.options.storage.acquire();if(!lease)return output(await this.options.storage.read(),"refreshing");try{
   const d=lease.disk as NewsDisk,now=this.now(),day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);d.profiles??={};
   if(d.day!==day){d.day=day;d.used=0;}if(d.minute!==minute){d.minute=minute;d.minuteUsed=0;}if(d.profileMinute!==minute){d.profileMinute=minute;d.profileMinuteUsed=0;}
   if(d.blockedUntil>now||d.used>=(this.options.dayBudget??500)||d.minuteUsed>=(this.options.minuteBudget??10))return output(d,"quota_exhausted");
   if(now<(d.profileNext??0))return output(d,"ready");
   const allowance=Math.min(profileLimit-(d.profileMinuteUsed??0),minuteLimit-Math.min(2,Math.floor(minuteLimit/3))-d.minuteUsed,(this.options.dayBudget??500)-d.used);
   if(allowance<=0){d.profileNext=(minute+1)*60000;await lease.save(d);return output(d,"refreshing");}
   const selected=profileOrder(priority).filter(symbol=>!d.profiles![symbol]||now>=d.profiles![symbol].nextAt).slice(0,Math.min(3,allowance)).map(symbol=>({symbol}));
   d.profileNext=now+3000;await lease.save(d);let status:NewsStatus="ready";
   for(const s of selected){if(d.used>=(this.options.dayBudget??500)||d.minuteUsed>=minuteLimit){status="quota_exhausted";break;}const old=d.profiles[s.symbol];d.used++;d.minuteUsed++;d.profileMinuteUsed=(d.profileMinuteUsed??0)+1;await lease.save(d);
    try{const url=new URL("https://finnhub.io/api/v1/stock/profile2");url.searchParams.set("symbol",s.symbol);const r=await (this.options.fetcher??fetch)(url,{headers:{"X-Finnhub-Token":this.options.key},signal:AbortSignal.timeout(8000),cache:"no-store",redirect:"error"});
     if(r.status===429){const retry=r.headers.get("retry-after"),delay=retry&&/^\d+$/.test(retry)?Number(retry)*1000:retry?Date.parse(retry)-now:60000;d.blockedUntil=now+Math.max(60000,Number.isFinite(delay)?delay:60000);throw new NewsError("quota_exhausted");}if([401,403].includes(r.status)){d.blockedUntil=now+600000;throw new NewsError("access_denied");}if(!r.ok)throw new NewsError("unavailable");
     d.profiles[s.symbol]={value:normalizeProfile(await r.json(),s.symbol,this.now()),status:"ready",nextAt:now+86400000,attemptedAt:now};
    }catch(e){status=e instanceof NewsError?e.status:"unavailable";d.profiles[s.symbol]={...old,status,nextAt:Math.max(d.blockedUntil,now+600000),attemptedAt:now};}
    await lease.save(d);if(status==="quota_exhausted"||status==="access_denied")break;
   }if((d.profileMinuteUsed??0)>=profileLimit||d.minuteUsed>=minuteLimit-Math.min(2,Math.floor(minuteLimit/3)))d.profileNext=(minute+1)*60000;else if(!selected.length)d.profileNext=now+60000;await lease.save(d);return output(d,status);
  }finally{await lease.release().catch(()=>{});}}catch{return {provider:"Finnhub",entries:{},status:"storage_unavailable",retryAt:0,serverTime:this.now()};}
 }
 private output(disk:NewsDisk,scope:string,fallback:NewsStatus="refreshing"):NewsFeed{
  const row=disk.news?.[scope];if(!row)return emptyNews(scope,fallback);
  if(!Array.isArray(row.articles)||!Number.isFinite(row.fetchedAt)||!Number.isFinite(row.nextAt)||!(row.status in NEWS_MESSAGES))throw Error("Invalid cached news");
  return {scope,provider:"Finnhub",articles:row.articles,status:row.status,message:NEWS_MESSAGES[row.status],fetchedAt:row.fetchedAt||null,retryAt:Math.max(row.nextAt,disk.blockedUntil),stale:!!row.fetchedAt&&(row.status!=="ready"||this.now()-row.fetchedAt>Math.max(300000,this.options.ttlMs??600000))};
 }
 get(scope="market"):Promise<NewsFeed>{
  if(!this.options.key)return Promise.resolve(emptyNews(scope,"not_configured"));
  const work=()=>scope==="market"?this.catalog():this.refresh(scope);const next=this.queue.then(work,work);this.queue=next.catch(()=>{});return next;
 }
 private catalogOutput(disk:NewsDisk,lastStatus?:NewsStatus):NewsFeed{
  const now=this.now(),rows=STOCKS.map(s=>disk.news?.[s.symbol]).filter((r):r is Entry=>!!r);
  const successful=rows.filter(r=>r.fetchedAt>0),articles=mergeCompanyNews(successful.map(r=>r.articles),now);
  const day=new Date(now).toISOString().slice(0,10);
  const limited=disk.day===day&&disk.used>=(this.options.dayBudget??500);
  const status:NewsStatus=limited?"quota_exhausted":disk.blockedUntil>now?(rows.some(r=>r.status==="access_denied")?"access_denied":"quota_exhausted"):lastStatus&&lastStatus!=="ready"?lastStatus:rows.some(r=>r.status!=="ready")?"unavailable":successful.length?"ready":"refreshing";
  const freshest=Math.max(0,...successful.map(r=>r.fetchedAt));
  return {scope:"market",provider:"Finnhub",articles,status,message:NEWS_MESSAGES[status],fetchedAt:freshest||null,retryAt:Math.max(disk.newsCatalogNext??0,disk.blockedUntil,limited?Date.parse(day)+86400000:0),stale:!!freshest&&now-freshest>Math.max(21600000,this.options.catalogTtlMs??21600000),coverage:{checked:successful.length,total:STOCKS.length}};
 }
 private async catalog():Promise<NewsFeed>{
  try{
   const lease=await this.options.storage.acquire();
   if(!lease)return this.catalogOutput(await this.options.storage.read());
   let selected:string[]=[];
   try{
    const disk=lease.disk as NewsDisk,now=this.now(),day=new Date(now).toISOString().slice(0,10);
    if(now>=(disk.newsCatalogNext??0)&&now>=disk.blockedUntil&&!(disk.day===day&&disk.used>=(this.options.dayBudget??500))){
     const ttl=Math.max(21600000,this.options.catalogTtlMs??21600000);
     selected=STOCKS.filter(s=>{const r=disk.news?.[s.symbol];return !r||(now>=r.nextAt&&(!r.fetchedAt||now-r.fetchedAt>=ttl));})
      .sort((a,b)=>(disk.news?.[a.symbol]?.attemptedAt??disk.news?.[a.symbol]?.fetchedAt??0)-(disk.news?.[b.symbol]?.attemptedAt??disk.news?.[b.symbol]?.fetchedAt??0)).slice(0,2).map(s=>s.symbol);
     // Reserve one bounded batch across ALL instances before releasing the lease.
     disk.newsCatalogNext=now+60000;await lease.save(disk);
    }
   }finally{await lease.release();}
   let status:NewsStatus|undefined;
   for(const symbol of selected){const feed=await this.refresh(symbol);if(feed.status!=="ready")status=feed.status;if(feed.status==="quota_exhausted"||feed.status==="access_denied"||feed.status==="storage_unavailable")break;}
   return this.catalogOutput(await this.options.storage.read(),status);
  }catch{return emptyNews("market","storage_unavailable");}
 }
 private async refresh(scope:string):Promise<NewsFeed>{
  try{
   const lease=await this.options.storage.acquire();
   if(!lease)return this.output(await this.options.storage.read(),scope);
   try{
    const disk=lease.disk as NewsDisk;
    disk.universe??={quotes:{},histories:{},catalog:{},logosChecked:{}};
    if(disk.news!==undefined&&(!disk.news||typeof disk.news!=="object"||Array.isArray(disk.news)))throw Error();
    disk.news??={};const old=disk.news[scope],now=this.now();
    if(old&&now<old.nextAt)return this.output(disk,scope);
    const day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);
    if(disk.day!==day){disk.day=day;disk.used=0;}if(disk.minute!==minute){disk.minute=minute;disk.minuteUsed=0;}
    const wait=disk.blockedUntil>now?disk.blockedUntil:disk.used>=(this.options.dayBudget??500)?Date.parse(day)+86400000:disk.minuteUsed>=(this.options.minuteBudget??10)?(minute+1)*60000:0;
    if(wait){disk.news[scope]={articles:old?.articles??[],fetchedAt:old?.fetchedAt??0,status:"quota_exhausted",nextAt:wait};await lease.save(disk);return this.output(disk,scope);}
    disk.used++;disk.minuteUsed++;await lease.save(disk);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
     const url=new URL("https://finnhub.io/api/v1/company-news");
     url.searchParams.set("symbol",scope);url.searchParams.set("from",new Date(now-7*86400000).toISOString().slice(0,10));url.searchParams.set("to",day);
     const response=await (this.options.fetcher??fetch)(url,{headers:{"X-Finnhub-Token":this.options.key},signal:controller.signal,cache:"no-store",redirect:"error"});
     if(response.status===429){const retry=response.headers.get("retry-after");const ms=retry&&/^\d+$/.test(retry)?Number(retry)*1000:retry?Math.max(0,Date.parse(retry)-now):0;throw new NewsError("quota_exhausted",Number.isFinite(ms)?ms:0);}
     if([401,403].includes(response.status))throw new NewsError("access_denied");if(!response.ok)throw new NewsError("unavailable");
     const raw=await response.json();if(!Array.isArray(raw))throw new NewsError("unavailable");
     const articles=normalizeNews(raw,scope,this.now());disk.failures=0;
     disk.news[scope]={articles,fetchedAt:this.now(),status:"ready",nextAt:this.now()+Math.max(300000,this.options.ttlMs??600000),attemptedAt:now};
    }catch(error){
     const status=error instanceof NewsError?error.status:"unavailable";
     if(status==="quota_exhausted"){disk.failures++;disk.blockedUntil=now+Math.max(error instanceof NewsError?error.retryMs:0,Math.min(900000,60000*2**Math.min(disk.failures-1,4)));}
     if(status==="access_denied")disk.blockedUntil=now+600000;
     disk.news[scope]={articles:old?.articles??[],fetchedAt:old?.fetchedAt??0,status,nextAt:Math.max(disk.blockedUntil,now+120000),attemptedAt:now};
    }finally{clearTimeout(timeout);}
    await lease.save(disk);return this.output(disk,scope);
   }finally{await lease.release().catch(()=>{});}
  }catch{return emptyNews(scope,"storage_unavailable");}
 }
}
