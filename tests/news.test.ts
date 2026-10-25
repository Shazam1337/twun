import test from "node:test";
import assert from "node:assert/strict";
import {filterNews,mergeCompanyNews,newsCompanies,normalizeNews} from "../lib/news";
import {NewsProvider} from "../lib/news-provider";
import {emptyProviderDisk} from "../lib/twelve-provider";
import {MarketStorage,MarketLease} from "../lib/market-storage";
import {UniverseDisk} from "../lib/universe-provider";
const now=Date.UTC(2026,9,19,15);
const article=(overrides:Record<string,unknown>={})=>({headline:"Company announces quarterly results",summary:"Publisher summary",source:"Publisher",url:"https://publisher.example/story",datetime:now/1000,related:"NVDA",...overrides});
test("news retains more than 40 unique valid stories in latest-first order",()=>{
 const raw=Array.from({length:85},(_,i)=>article({url:`https://publisher.example/story-${i}`,datetime:now/1000-i*60}));
 const items=normalizeNews([...raw.reverse(),raw[0]],"market",now);
 assert.equal(items.length,85);assert.equal(items[0].url,"https://publisher.example/story-0");assert.equal(items[84].url,"https://publisher.example/story-84");
});
test("news filters combine related stocks, publisher, publication age and company search",()=>{
 const items=normalizeNews([
  article({headline:"Oracle reports results",related:"",url:"https://publisher.example/oracle"}),
  article({headline:"NVIDIA earnings",source:"Second publisher",datetime:now/1000-2*86400,url:"https://publisher.example/nvidia"}),
  article({headline:"Global economic outlook",related:"UNKNOWN",url:"https://publisher.example/macro"}),
  article({headline:"Quarterly update",datetime:now/1000-86400,url:"https://publisher.example/boundary"})
 ],"market",now);
 const filters={search:"",relatedOnly:false,source:"",period:"all" as const};
 assert.equal(filterNews(items,filters,now).length,4);
 assert.equal(filterNews(items,{...filters,relatedOnly:true},now).length,3);
 assert.deepEqual(filterNews(items,{...filters,relatedOnly:true,period:"24h",search:"ORCL",source:"Publisher"},now).map(a=>a.headline),["Oracle reports results"]);
 assert.equal(filterNews(items,{...filters,period:"24h"},now).length,3);
 assert.equal(filterNews(items,{...filters,source:"Second publisher",period:"24h"},now).length,0);
 assert.equal(filterNews(items,{...filters,source:"Second publisher",period:"7d"},now).length,1);
 assert.equal(filterNews(items,{...filters,source:"Unknown publisher"},now).length,0);
});
function storage(){let disk:UniverseDisk=emptyProviderDisk(),locked=false;return {
 read:async()=>structuredClone(disk),acquire:async():Promise<MarketLease|null>=>{if(locked)return null;locked=true;return {disk:structuredClone(disk),save:async d=>{disk=structuredClone(d);},release:async()=>{locked=false;}};}
 } satisfies MarketStorage;}

test("catalog news merges duplicate URLs and unions company associations without retaining expired stories",()=>{
 const a=normalizeNews([article()],"NVDA",now)[0],b={...a,symbols:["TSLA","UNKNOWN"]};
 const result=mergeCompanyNews([[a],[b,{...a,url:"https://publisher.example/expired",publishedAt:now-8*86400000}]],now);
 assert.equal(result.length,1);assert.deepEqual(result[0].symbols,["NVDA","TSLA"]);
});

test("catalog batches share cache across instances, rotate all 50 stocks and honor a six-hour TTL",async()=>{
 const s=storage();let clock=now,calls=0;
 const fetcher:typeof fetch=async url=>{calls++;const u=new URL(String(url)),symbol=u.searchParams.get("symbol")!;assert.equal(u.pathname,"/api/v1/company-news");return Response.json([article({related:symbol,url:"https://publisher.example/"+symbol,datetime:clock/1000})]);};
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,fetcher,now:()=>clock});
 let feed=await make().get();assert.equal(calls,2);assert.equal(feed.coverage?.checked,2);assert.equal(feed.articles.length,2);
 await make().get();assert.equal(calls,2);await make().get("AAPL");assert.equal(calls,2);
 for(let i=1;i<25;i++){clock+=60001;feed=await make().get();}
 assert.equal(calls,50);assert.equal(feed.coverage?.checked,50);assert.equal(feed.articles.length,50);
 clock+=60001;await make().get();assert.equal(calls,50);
 clock=now+21600001;await make().get();assert.equal(calls,52);
});

test("catalog partial failure preserves other companies, progresses past failures and recovers via shared company cache",async()=>{
 const s=storage();let clock=now,bad=true,calls=0;
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,now:()=>clock,fetcher:async url=>{calls++;const symbol=new URL(String(url)).searchParams.get("symbol")!;return bad&&symbol==="MSFT"?new Response("",{status:503}):Response.json([article({related:symbol,url:"https://publisher.example/"+symbol})]);}});
 const first=await make().get();assert.equal(first.status,"unavailable");assert.equal(first.coverage?.checked,1);assert.equal(first.articles.length,1);
 clock+=60001;await make().get();assert.equal(calls,4);
 clock+=60001;await make().get();assert.equal(calls,6); // failure cannot starve unchecked companies
 bad=false;await make().get("MSFT");assert.equal(calls,7);const restored=await make().get();assert.equal(restored.status,"ready");assert.ok(restored.articles.some(a=>a.symbols.includes("MSFT")));
});

test("catalog respects global daily quota and 429 backoff across independent instances",async()=>{
 const s=storage();let calls=0;
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,dayBudget:1,now:()=>now,fetcher:async url=>{calls++;return Response.json([article({related:new URL(String(url)).searchParams.get("symbol")!})]);}});
 const result=await make().get();assert.equal(result.status,"quota_exhausted");assert.equal(calls,1);await make().get();assert.equal(calls,1);
 const q=storage();let attempts=0;
 const retry=()=>new NewsProvider({key:"fixture-key",storage:q,now:()=>now,fetcher:async()=>{attempts++;return new Response("",{status:429,headers:{"Retry-After":"180"}});}});
 assert.equal((await retry().get()).status,"quota_exhausted");assert.equal((await retry().get()).status,"quota_exhausted");assert.equal(attempts,1);
});
test("news validates attribution, timestamps, URLs and stock association; sorts and deduplicates",()=>{
 const items=normalizeNews([article({url:"https://publisher.example/story?utm_source=duplicate"}),article(),article({url:"javascript:alert(1)"}),article({url:"https://publisher.example/future",datetime:now/1000+400}),article({url:"https://publisher.example/old",datetime:now/1000-8*86400}),article({url:"https://publisher.example/other",related:"TSLA"})],"NVDA",now);
 assert.equal(items.length,1);assert.equal(items[0].url,"https://publisher.example/story");assert.deepEqual(items[0].symbols,["NVDA"]);
 assert.throws(()=>normalizeNews({error:"access"},"market",now));assert.deepEqual(normalizeNews([],"market",now),[]);
});
test("news companies combine deduplicated source tags and explicit company-name mentions",()=>{
 const result=newsCompanies({symbols:["TSLA","TSLA","UNKNOWN"],headline:"Oracle and NVIDIA report results",summary:"Google, Microsoft, Apple and Amazon are also mentioned."});
 assert.equal(result.filter(s=>s.symbol==="TSLA").length,1);assert.equal(result.find(s=>s.symbol==="TSLA")!.basis,"source");
 for(const symbol of ["ORCL","NVDA","GOOGL","MSFT","AAPL","AMZN"])assert.equal(result.find(s=>s.symbol===symbol)!.basis,"mention");
 assert.equal(result.some(s=>s.symbol==="UNKNOWN"),false);
});
test("news company matching avoids ordinary short ticker words and escapes ticker punctuation",()=>{
 assert.deepEqual(newsCompanies({symbols:[],headline:"A cat copes with a cost increase in visa applications",summary:"The stock market is open."}),[]);
 const result=newsCompanies({symbols:[],headline:"$BRK.B and (T) mentioned; Visa shares rise",summary:""});
 for(const symbol of ["BRK.B","T","V"])assert.ok(result.some(s=>s.symbol===symbol));
});
test("news cache survives independent providers and charges before fetch, with header-only authentication",async()=>{
 const s=storage();let calls=0;
 const fetcher:typeof fetch=async(url,init)=>{calls++;const u=new URL(String(url));assert.equal(u.searchParams.has("token"),false);assert.equal(new Headers(init?.headers).get("X-Finnhub-Token"),"fixture-key");assert.ok((await s.read()).used>0);return Response.json([article()]);};
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,fetcher,now:()=>now});
 assert.equal((await make().get("NVDA")).articles.length,1);assert.equal((await make().get("NVDA")).status,"ready");assert.equal(calls,1);assert.equal((await s.read()).used,1);
});
test("concurrent instances deduplicate; pair scopes do not reuse another company's headlines",async()=>{
 const s=storage();let calls=0;
 const fetcher:typeof fetch=async url=>{calls++;const symbol=new URL(String(url)).searchParams.get("symbol")!;return Response.json([article({related:symbol,url:"https://publisher.example/"+symbol})]);};
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,fetcher,now:()=>now});
 const result=await Promise.all([make().get("NVDA"),make().get("NVDA")]);assert.equal(calls,1);assert.ok(result.some(f=>f.status==="refreshing"));
 const other=await make().get("TSLA");assert.equal(calls,2);assert.ok(other.articles.every(a=>a.symbols.includes("TSLA")));
});
test("quota, 429 cooldown and access denial are persisted without retry loops",async()=>{
 const s=storage();let calls=0;
 const make=()=>new NewsProvider({key:"fixture-key",storage:s,now:()=>now,fetcher:async()=>{calls++;return new Response("",{status:429,headers:{"Retry-After":"180"}});}});
 assert.equal((await make().get("NVDA")).status,"quota_exhausted");const second=await make().get("TSLA");assert.equal(second.status,"quota_exhausted");assert.equal(second.retryAt,now+180000);assert.equal(calls,1);
 const denied=new NewsProvider({key:"fixture-key",storage:storage(),now:()=>now,fetcher:async()=>new Response("",{status:403})});assert.equal((await denied.get()).status,"access_denied");
});
test("partial service failure retains dated headlines; other scopes remain independent",async()=>{
 let clock=now,bad=false;const s=storage();const make=()=>new NewsProvider({key:"fixture-key",storage:s,now:()=>clock,fetcher:async()=>bad?new Response("",{status:503}):Response.json([article({datetime:clock/1000})])});
 await make().get("NVDA");clock+=700000;bad=true;const failed=await make().get("NVDA");assert.equal(failed.status,"unavailable");assert.equal(failed.stale,true);assert.equal(failed.articles.length,1);assert.equal(failed.fetchedAt,now);
});
test("missing key and storage failure make no upstream requests",async()=>{
 let calls=0;const broken:MarketStorage={read:async()=>{throw Error();},acquire:async()=>{throw Error();}};
 const fetcher:typeof fetch=async()=>{calls++;throw Error();};
 assert.equal((await new NewsProvider({key:"",storage:broken,fetcher}).get()).status,"not_configured");assert.equal((await new NewsProvider({key:"fixture-key",storage:broken,fetcher}).get()).status,"storage_unavailable");assert.equal(calls,0);
 const noSave:MarketStorage={read:async()=>emptyProviderDisk(),acquire:async()=>({disk:emptyProviderDisk(),save:async()=>{throw Error();},release:async()=>{}})};
 assert.equal((await new NewsProvider({key:"fixture-key",storage:noSave,fetcher}).get()).status,"storage_unavailable");assert.equal(calls,0);
});
