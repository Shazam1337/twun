import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PAIR,Pair,pairId,canonicalPair,STOCKS,PRESETS,stock,validPair} from "../lib/catalog";
import {actOnPair,adoptPair,isMultiAccount,migrateAccount,MultiAccount} from "../lib/multi-account";
import {initialLiveAccount,adoptIndex,isLiveAccount} from "../lib/live-account";
import {openPosition,pnl,totals,Result} from "../lib/perps";
import {pairFeed,joinHistory,UniverseCache} from "../lib/universe-feed";
import {UniverseProvider} from "../lib/universe-provider";
import {emptyProviderDisk} from "../lib/twelve-provider";
const at=Date.UTC(2026,8,25,16), apple={base:"AAPL",quote:"MSFT"};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function quotes(now=at,prices:Record<string,number>={NVDA:100,TSLA:200,AAPL:200,MSFT:400}):UniverseCache["quotes"]{
 return Object.fromEntries(Object.entries(prices).map(([symbol,price])=>[symbol,{status:"ready",checkedAt:now,nextAt:now+120000,value:{symbol,price,currency:"USD",timestamp:now,marketOpen:true}}]));
}
const feed=(p=DEFAULT_PAIR,price=100,now=at)=>pairFeed(p,quotes(now,{[p.base]:price,[p.quote]:200}),now);
const state=(r:Result)=>{assert.ok(r.ok);return r.state as MultiAccount;};
const open=(s:MultiAccount,p=DEFAULT_PAIR,price=100)=>state(actOnPair(s,p,feed(p,price),at,{kind:"open",side:"Long",margin:100,leverage:5}));
test("50 unique stocks / 11 sectors; distinct valid pairs; inverse presets are deduplicated",()=>{
 assert.equal(STOCKS.length,50);assert.equal(new Set(STOCKS.map(s=>s.symbol)).size,50);assert.equal(new Set(STOCKS.map(s=>s.sector)).size,11);
 assert.equal(new Set(PRESETS.map(canonicalPair)).size,PRESETS.length);
 assert.equal(validPair({base:"AAPL",quote:"AAPL"}),false);assert.equal(validPair({base:"UNKNOWN",quote:"MSFT"}),false);
 assert.equal(canonicalPair(apple),canonicalPair({base:"MSFT",quote:"AAPL"}));
});
test("independent simultaneous positions, selected-pair funding, close and serialization",()=>{
 let s=open(migrateAccount(initialLiveAccount(at)));s=open(s,apple,200);
 const nv=s.positions.find(p=>p.pair?.base==="NVDA")!,ap=s.positions.find(p=>p.pair?.base==="AAPL")!;
 s=state(adoptPair(s,DEFAULT_PAIR,feed(DEFAULT_PAIR,110),at));near(pnl(s.positions.find(p=>p.id===nv.id)!,s.pairMarks[pairId(DEFAULT_PAIR)].mark),50);
 assert.deepEqual(s.positions.find(p=>p.id===ap.id),ap);near(totals(s).pnl,50);
 s=state(actOnPair(s,apple,feed(apple,200),at,{kind:"funding"}));assert.equal(s.positions.find(p=>p.id===nv.id)!.funding,0);near(s.positions.find(p=>p.id===ap.id)!.funding,.05);
 assert.ok(isMultiAccount(JSON.parse(JSON.stringify(s))));
 s=state(actOnPair(s,DEFAULT_PAIR,feed(DEFAULT_PAIR,110),at,{kind:"close",id:nv.id}));assert.equal(s.positions.length,1);near(s.freeUsdc,9949.25);
 assert.ok(s.history.every(e=>e.pair));assert.ok(isMultiAccount(s));
});
test("reversing selection cannot update or liquidate another orientation; pair gate rejects wrong index",()=>{
 let s=open(migrateAccount(initialLiveAccount(at)));const original=structuredClone(s.positions[0]);
 const reverse={base:"TSLA",quote:"NVDA"};const q=quotes();
 near(pairFeed(DEFAULT_PAIR,q,at).snapshot!.ratio*pairFeed(reverse,q,at).snapshot!.ratio,1);
 s=state(adoptPair(s,reverse,pairFeed(reverse,q,at),at));assert.deepEqual(s.positions[0],original);
 assert.equal(adoptPair(s,DEFAULT_PAIR,pairFeed(reverse,q,at),at).ok,false);
 s=open(s,apple,200);const applePosition=structuredClone(s.positions.find(p=>p.pair?.base==="AAPL"));
 s=state(adoptPair(s,DEFAULT_PAIR,feed(DEFAULT_PAIR,80),at));assert.equal(s.positions.some(p=>p.id===original.id),false);assert.deepEqual(s.positions[0],applePosition);
});
test("one-symbol failure, skew, stale and closed pairs freeze locally; other pair and atomic recovery work",()=>{
 let s=open(open(migrateAccount(initialLiveAccount(at))),apple,200);const before=structuredClone(s);
 const q=quotes();q.NVDA.status="unavailable";q.TSLA.value!.price=1000;
 assert.equal(adoptPair(s,DEFAULT_PAIR,pairFeed(DEFAULT_PAIR,q,at),at).ok,false);assert.deepEqual(s,before);
 assert.equal(pairFeed(apple,q,at).canTrade,true);
 q.NVDA.status="ready";q.NVDA.value!.timestamp=at-61000;assert.equal(pairFeed(DEFAULT_PAIR,q,at).status,"desynchronized");
 q.NVDA.value!.timestamp=at-360000;q.TSLA.value!.timestamp=at-360000;assert.equal(pairFeed(DEFAULT_PAIR,q,at).status,"stale");
 const closed=Date.UTC(2026,8,26,16);assert.equal(actOnPair(s,apple,feed(apple,200,closed),closed,{kind:"close",id:s.positions[1].id}).ok,true);
 s=state(adoptPair(s,DEFAULT_PAIR,feed(DEFAULT_PAIR,110,at+120000),at+120000));near(totals(s).pnl,50);
 assert.equal(s.pairMarks[pairId(apple)].mark,1);
});
test("v3 migration preserves existing IDs, margin, entries, source, fees and history without repricing",()=>{
 const accepted=adoptIndex(initialLiveAccount(at),feed(),at);assert.ok(accepted.ok);const r=openPosition(accepted.state,"Short",100,5);assert.ok(r.ok);
 const v3={...r.state,positions:r.state.positions.map(p=>({...p,dataSource:accepted.state.acceptedIndex!.source,entryIndexTime:at,entryIndexId:accepted.state.acceptedIndex!.id}))};
 assert.ok(isLiveAccount(v3));const raw=JSON.stringify(v3),s=migrateAccount(v3);
 assert.equal(JSON.stringify(v3),raw);assert.ok(isMultiAccount(s));assert.equal(s.freeUsdc,v3.freeUsdc);
 for(const [key,value] of Object.entries(v3.positions[0]))assert.deepEqual(s.positions[0][key as keyof typeof s.positions[0]],value);
 assert.equal(s.positions[0].mark,v3.mark);assert.deepEqual(s.positions[0].pair,DEFAULT_PAIR);
});
test("ratio history joins timestamps only, reverses exactly, and preserves gaps",()=>{
 const a={status:"ready" as const,checkedAt:at,nextAt:at+1,values:[[at-300000,100],[at,110],[at+300000,120]] as [number,number][]};
 const b={...a,values:[[at-300000,200],[at,200]] as [number,number][]};
 const ab=joinHistory(a,b,"5min")!,ba=joinHistory(b,a,"5min")!;
 assert.deepEqual(ab.points.map(p=>p.value),[.5,.55,null]);near(ab.points[1].value!*ba.points[1].value!,1);assert.equal(ab.unmatched,1);
});
function fakeProvider(getNow:()=>number,calls:URL[],fail:()=>number=()=>0){
 return (async(input:URL|RequestInfo)=>{const url=new URL(String(input));calls.push(url);if(fail())return new Response("{}",{status:fail(),headers:{"retry-after":"180"}});
 const symbols=url.searchParams.get("symbol")!.split(",");
 const data=Object.fromEntries(symbols.map(symbol=>[symbol,url.pathname==="/quote"?{symbol,exchange:stock(symbol)!.exchange,currency:"USD",close:100,last_quote_at:getNow()/1000,is_market_open:true}:{meta:{symbol,exchange:stock(symbol)!.exchange,currency:"USD",interval:url.searchParams.get("interval"),exchange_timezone:"America/New_York"},values:[{datetime:"2026-09-23",close:"100"},{datetime:"2026-09-24",close:"110"}]}]));
 return Response.json(symbols.length===1?data[symbols[0]]:data);
 }) as typeof fetch;
}
test("shared-symbol cache, parallel deduplication, on-demand history and minute/day accounting",async()=>{
 let now=at;const calls:URL[]=[],disk=emptyProviderDisk();const p=new UniverseProvider({key:"test-only",disk,now:()=>now,fetcher:fakeProvider(()=>now,calls)});
 await Promise.all([p.get(DEFAULT_PAIR,[],"1day"),p.get(DEFAULT_PAIR,[],"1day")]);assert.equal(calls.length,3);assert.equal(disk.used,4);
 await p.get({base:"NVDA",quote:"AAPL"},["NVDA","TSLA"],"1day");assert.equal(disk.used,6);assert.equal(calls.filter(c=>c.pathname==="/quote"&&c.searchParams.get("symbol")==="AAPL").length,1);
 assert.ok(calls.every(c=>c.searchParams.get("symbol")!.split(",").length<=2));
 const reverse=await p.get({base:"TSLA",quote:"NVDA"},[],"1day");assert.equal(disk.used,6);assert.ok(reverse.market.histories["1day"]);
 now+=120000;await p.get(DEFAULT_PAIR,["NVDA","AAPL"],"1day");assert.equal(disk.used,9);assert.equal(calls.filter(c=>c.pathname==="/time_series").length,3);
});
test("shared 429 cooldown, day budget, no key and quote recovery",async()=>{
 let now=at,fail=429;const calls:URL[]=[],disk=emptyProviderDisk();const options={key:"test-only",disk,now:()=>now,fetcher:fakeProvider(()=>now,calls,()=>fail)};
 const p=new UniverseProvider(options);let result=await p.get(DEFAULT_PAIR,[],"1day");assert.equal(result.market.status,"quota_exhausted");assert.equal(calls.length,1);assert.equal(disk.used,2);
 now+=120000;await p.get(DEFAULT_PAIR,[],"1day");assert.equal(calls.length,1);
 now+=61000;fail=0;result=await p.get(DEFAULT_PAIR,[],"1day");assert.equal(result.market.status,"ready");assert.ok(result.market.canTrade);
 const limited=new UniverseProvider({...options,dayBudget:disk.used});const before=calls.length;now+=120000;assert.equal((await limited.get(DEFAULT_PAIR,[],"1day")).market.status,"quota_exhausted");assert.equal(calls.length,before);
 assert.equal((await new UniverseProvider({...options,key:""}).get(DEFAULT_PAIR,[],"1day")).market.status,"not_configured");assert.equal(calls.length,before);
});
test("HTTP200 per-symbol 429 also activates shared backoff without invalidating unrelated stocks",async()=>{
 let now=at;const calls:URL[]=[];
 const fetcher=(async(input:URL|RequestInfo)=>{calls.push(new URL(String(input)));return Response.json({NVDA:{symbol:"NVDA",exchange:"NASDAQ",currency:"USD",close:100,last_quote_at:now/1000,is_market_open:true},TSLA:{status:"error",code:429}});}) as typeof fetch;
 const p=new UniverseProvider({key:"test-only",now:()=>now,fetcher});
 const first=await p.get(DEFAULT_PAIR,[],"1day");assert.equal(first.market.status,"quota_exhausted");assert.equal(first.quotes.NVDA.status,"ready");assert.equal(calls.length,1);
 now+=30000;await p.get(apple,[],"1day");assert.equal(calls.length,1);
});
test("pre-session cache refreshes at regular opening and no-key responses expose no quote/history values",async()=>{
 let now=Date.UTC(2026,8,25,12),calls:URL[]=[];const disk=emptyProviderDisk();
 const p=new UniverseProvider({key:"test-only",disk,now:()=>now,fetcher:fakeProvider(()=>now,calls)});
 assert.equal((await p.get(DEFAULT_PAIR,[],"1day")).market.canTrade,true);
 const before=calls.filter(c=>c.pathname==="/quote").length;
 now=Date.UTC(2026,8,25,13,31);
 assert.equal((await p.get(DEFAULT_PAIR,[],"1day")).market.canTrade,true);
 assert.equal(calls.filter(c=>c.pathname==="/quote").length,before+1);
 const empty=await new UniverseProvider({key:"",disk,now:()=>now}).get(DEFAULT_PAIR,[],"1day");
 assert.deepEqual(empty.quotes,{});assert.equal(empty.market.histories["1day"],null);
});
test("weekend last-price opening/closing, fees, persisted marks and paused funding",()=>{
 const weekend=Date.UTC(2026,8,26,16),q=quotes(at);
 Object.values(q).forEach(c=>c.value!.marketOpen=false);
 const f=pairFeed(DEFAULT_PAIR,q,weekend);assert.ok(f.canTrade);
 let s=state(actOnPair(migrateAccount(initialLiveAccount(weekend)),DEFAULT_PAIR,f,weekend,{kind:"open",side:"Long",margin:100,leverage:5}));
 near(s.freeUsdc,9899.75);near(totals(s).pnl,0);assert.ok(isMultiAccount(JSON.parse(JSON.stringify(s))));
 const original=JSON.stringify(s);
 assert.equal(actOnPair(s,DEFAULT_PAIR,f,weekend,{kind:"funding"}).ok,false);assert.equal(JSON.stringify(s),original);
 const later=pairFeed(DEFAULT_PAIR,q,weekend+3600000);s=state(adoptPair(s,DEFAULT_PAIR,later,weekend+3600000));
 near(totals(s).pnl,0);assert.equal(s.positions[0].funding,0);
 s=state(actOnPair(s,DEFAULT_PAIR,later,weekend+3600000,{kind:"close",id:s.positions[0].id}));
 near(s.freeUsdc,9999.5);near(s.history[0].pnl,0);near(s.history[0].net,-.5);
});
test("weekend validation is not a fallback for bad data; reopening rejects old quotes then settles gaps",()=>{
 const weekend=Date.UTC(2026,8,26,16),monday=Date.UTC(2026,8,28,14),q=quotes(at);
 Object.values(q).forEach(c=>c.value!.marketOpen=false);
 const good=pairFeed(DEFAULT_PAIR,q,weekend);
 const s=state(actOnPair(migrateAccount(initialLiveAccount(weekend)),DEFAULT_PAIR,good,weekend,{kind:"open",side:"Long",margin:100,leverage:5}));
 for(const change of [(c:typeof q)=>{delete c.NVDA;},(c:typeof q)=>{c.NVDA.status="unavailable";},(c:typeof q)=>{c.NVDA.value!.price=-1;},(c:typeof q)=>{c.NVDA.value!.timestamp-=61000;},(c:typeof q)=>{c.NVDA.value!.currency="EUR" as "USD";},(c:typeof q)=>{c.NVDA.value!.timestamp=weekend+20000;}]){
  const bad=structuredClone(q);change(bad);assert.equal(adoptPair(s,DEFAULT_PAIR,pairFeed(DEFAULT_PAIR,bad,weekend),weekend).ok,false);
 }
 assert.equal(adoptPair(s,DEFAULT_PAIR,good,monday).ok,false);
 assert.equal(adoptPair(s,DEFAULT_PAIR,pairFeed(DEFAULT_PAIR,q,monday),monday).ok,false);
 const fresh=quotes(monday,{NVDA:110,TSLA:200});
 const risen=state(adoptPair(s,DEFAULT_PAIR,pairFeed(DEFAULT_PAIR,fresh,monday),monday));near(totals(risen).pnl,50);assert.equal(risen.positions[0].funding,0);
 fresh.NVDA.value!.price=80;
 const liquidated=state(adoptPair(s,DEFAULT_PAIR,pairFeed(DEFAULT_PAIR,fresh,monday),monday));
 assert.equal(liquidated.positions.length,0);assert.equal(liquidated.history[0].kind,"Liquidation");near(liquidated.history[0].ratio,.4);
});
