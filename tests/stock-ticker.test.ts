import test from "node:test";
import assert from "node:assert/strict";
import {stockTicker} from "../lib/stock-ticker";
import {UniverseCache} from "../lib/universe-feed";
import {UniverseProvider} from "../lib/universe-provider";
import {emptyProviderDisk} from "../lib/twelve-provider";
const now=Date.UTC(2026,9,2,15), target=now-86400000;
function cache(price=110):UniverseCache{return {quotes:{NVDA:{status:"ready",checkedAt:now,nextAt:now+120000,value:{symbol:"NVDA",price,currency:"USD",timestamp:now,marketOpen:true}}},histories:{"NVDA:5min":{status:"ready",checkedAt:now,nextAt:now+1800000,values:[[target-300000,100]]}},catalog:{},logosChecked:{}};}
test("ticker computes signed 24h changes from completed 5m closes, not daily/previous-bar change",()=>{
 assert.ok(Math.abs(stockTicker(cache(),now,true).items.find(i=>i.symbol==="NVDA")!.change24h!-10)<1e-9);
 assert.ok(Math.abs(stockTicker(cache(90),now,true).items.find(i=>i.symbol==="NVDA")!.change24h!+10)<1e-9);
 assert.equal(stockTicker(cache(100),now,true).items.find(i=>i.symbol==="NVDA")!.change24h,0);
});
test("ticker rejects missing/future reference and invalid quotes; no weekend or daily fallback",()=>{
 const c=cache();c.histories["NVDA:5min"].values=[[target,100],[target-600000,100]];
 assert.equal(stockTicker(c,now,true).items.find(i=>i.symbol==="NVDA")!.change24h,null);
 c.quotes.NVDA.value!.price=NaN;assert.equal(stockTicker(c,now,true).items.find(i=>i.symbol==="NVDA")!.price,null);
 assert.ok(stockTicker(cache(),now,false).items.every(i=>i.price===null));
});
test("ticker identifies cached data, keeps catalog coverage and never spends provider credits",()=>{
 const c=cache(),disk={...emptyProviderDisk(),universe:c};let requests=0;
 const provider=new UniverseProvider({key:"test-only",disk,now:()=>now+600000,fetcher:async()=>{requests++;throw Error();}});
 const feed=provider.ticker();assert.equal(feed.items.length,50);assert.equal(feed.items.find(i=>i.symbol==="NVDA")!.status,"cached");assert.equal(requests,0);assert.equal(disk.used,0);
});
