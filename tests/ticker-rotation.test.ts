import test from "node:test";
import assert from "node:assert/strict";
import {UniverseProvider,UniverseDisk} from "../lib/universe-provider";
import {SharedMarket} from "../lib/shared-market";
import {MarketStorage,MarketLease} from "../lib/market-storage";
import {emptyProviderDisk} from "../lib/twelve-provider";
import {stock,STOCKS} from "../lib/catalog";
import {stockTicker,lastRegularClose} from "../lib/stock-ticker";
const start=Date.UTC(2026,9,20,15);
function fetcher(now:()=>number,calls:URL[]):typeof fetch{return async input=>{
 const u=new URL(String(input));calls.push(u);assert.equal(u.pathname,"/quote");const symbols=u.searchParams.get("symbol")!.split(",");
 const rows=Object.fromEntries(symbols.map(symbol=>[symbol,{symbol,currency:"USD",exchange:stock(symbol)!.exchange,is_market_open:true,last_quote_at:Math.floor(now()/1000),close:"100"}]));return Response.json(symbols.length===1?rows[symbols[0]]:rows);
};}
function storage(initial:UniverseDisk){let disk=initial,locked=false;return {read:async()=>structuredClone(disk),acquire:async():Promise<MarketLease|null>=>{if(locked)return null;locked=true;return {disk:structuredClone(disk),save:async d=>{disk=structuredClone(d);},release:async()=>{locked=false;}};}} satisfies MarketStorage;}
test("ticker rotates all 50 symbols oldest-first, max two credits/minute, with no repeated viewer requests",async()=>{
 let time=start;const calls:URL[]=[],disk:UniverseDisk=emptyProviderDisk(),p=new UniverseProvider({key:"test",disk,now:()=>time,fetcher:fetcher(()=>time,calls)});
 await Promise.all([p.refreshTicker(),p.refreshTicker(),p.refreshTicker()]);assert.equal(calls.length,1);assert.equal(disk.used,2);assert.equal(disk.tickerRefresh?.used,2);
 for(let i=1;i<26;i++){time=start+i*60000;await p.refreshTicker();}
 assert.equal(Object.keys(disk.universe!.quotes).length,50);assert.equal(calls.flatMap(u=>u.searchParams.get("symbol")!.split(",")).length,50);assert.equal(disk.used,50);
 assert.ok(STOCKS.every(s=>disk.universe!.quotes[s.symbol]?.value?.timestamp!>=start));
});
test("ticker quota and concurrency survive independent instances, and reserve minute capacity for trading",async()=>{
 let time=start;const calls:URL[]=[],s=storage(emptyProviderDisk()),make=()=>new SharedMarket({key:"test",storage:s,now:()=>time,tickerDayBudget:4,fetcher:fetcher(()=>time,calls)});
 await Promise.all([make().refreshTicker(),make().refreshTicker()]);assert.equal(calls.length,1);
 time+=60000;await make().refreshTicker();time+=60000;const limited=await make().refreshTicker();assert.equal(calls.length,2);assert.equal(limited.refresh?.state,"budget_limited");assert.equal((await s.read()).used,4);
 const disk:UniverseDisk={...emptyProviderDisk(),day:"2026-10-20",minute:Math.floor(time/60000),minuteUsed:5,used:5};
 await new UniverseProvider({key:"test",disk,now:()=>time,fetcher:fetcher(()=>time,calls)}).refreshTicker();assert.equal(calls.length,2);assert.equal(disk.used,5);
});
test("ticker failures consume persisted allowance, honor 429 backoff, and do not dispatch after persistence failure",async()=>{
 let time=start,calls=0;const disk:UniverseDisk=emptyProviderDisk(),p=new UniverseProvider({key:"test",disk,now:()=>time,fetcher:async()=>{calls++;return new Response("",{status:429,headers:{"Retry-After":"180"}});}});
 assert.equal((await p.refreshTicker()).refresh.state,"backoff");time+=60000;await p.refreshTicker();assert.equal(calls,1);assert.equal(disk.used,2);assert.equal(disk.tickerRefresh?.used,2);
 const bad=new UniverseProvider({key:"test",now:()=>start,persist:async()=>{throw Error("Storage failed");},fetcher:async()=>{calls++;throw Error();}});await assert.rejects(bad.refreshTicker());assert.equal(calls,1);
 const noKey=await new UniverseProvider({key:"",fetcher:async()=>{calls++;throw Error();}}).refreshTicker();assert.equal(noKey.configured,false);assert.equal(calls,1);
});
test("stale/error quotes suppress old percentages; weekends only accept the most recent scheduled close",()=>{
 const old=Date.UTC(2026,8,25,19,59),closed=Date.UTC(2026,9,23,20),weekend=Date.UTC(2026,9,24,15);
 const disk:UniverseDisk=emptyProviderDisk(),p=new UniverseProvider({key:"test",disk,now:()=>start});
 const c=disk.universe!;c.quotes.NVDA={status:"ready",checkedAt:start,nextAt:start+120000,value:{symbol:"NVDA",currency:"USD",price:110,timestamp:old,marketOpen:true}};
 c.histories["NVDA:5min"]={status:"ready",checkedAt:start,nextAt:start+1,values:[[old-86400000-300000,100]]};
 const stale=p.ticker().items.find(i=>i.symbol==="NVDA")!;assert.equal(stale.price,110);assert.equal(stale.status,"cached");assert.equal(stale.change24h,null);
 assert.equal(lastRegularClose(weekend),closed);assert.equal(lastRegularClose(Date.UTC(2026,10,28,15)),Date.UTC(2026,10,27,18));
 c.quotes.NVDA.value!.timestamp=closed-60000;c.quotes.NVDA.value!.marketOpen=false;
 assert.equal(stockTicker(c,weekend,true).items.find(i=>i.symbol==="NVDA")!.status,"ready");
 c.quotes.NVDA.status="unavailable";assert.equal(stockTicker(c,weekend,true).items.find(i=>i.symbol==="NVDA")!.change24h,null);
});
test("history rotation reuses quote cache and uses the same global quota without changing account data",async()=>{
 const disk:UniverseDisk=emptyProviderDisk();let calls=0;const p=new UniverseProvider({key:"test",disk,now:()=>start,fetcher:async input=>{
  calls++;const u=new URL(String(input)),symbol=u.searchParams.get("symbol")!;assert.equal(u.pathname,"/time_series");assert.equal(u.searchParams.get("interval"),"5min");return Response.json({meta:{symbol,exchange:stock(symbol)!.exchange,currency:"USD",exchange_timezone:"America/New_York",interval:"5min"},values:[{datetime:"2026-10-19 14:50:00",close:"100"},{datetime:"2026-10-19 14:55:00",close:"110"}]});
 }});
 for(const s of STOCKS)disk.universe!.quotes[s.symbol]={status:"ready",checkedAt:start,nextAt:start+120000,value:{symbol:s.symbol,price:120,currency:"USD",timestamp:start,marketOpen:true}};
 const before=structuredClone(disk.universe!.quotes);await p.refreshTicker();assert.equal(calls,1);assert.equal(disk.used,1);assert.equal(disk.tickerRefresh?.used,1);assert.deepEqual(disk.universe!.quotes,before);
});
