import test from "node:test";
import assert from "node:assert/strict";
import {UniverseProvider,UniverseDisk} from "../lib/universe-provider";
import {emptyProviderDisk} from "../lib/twelve-provider";
import {normalizeStockHistory} from "../lib/twelve-normalize";
const now=Date.UTC(2026,9,19,22),pair={base:"NVDA",quote:"TSLA"};
const raw=(symbol:string,interval="1min")=>({meta:{symbol,interval,currency:"USD",exchange:"NASDAQ",exchange_timezone:"America/New_York"},values:Array.from({length:15},(_,i)=>({datetime:`2026-10-19 13:${30+i}:00`,close:symbol==="NVDA"?100+i:200}))});
test("minute normalization accepts non-five-minute boundaries and rejects incomplete or off-grid observations",()=>{
 assert.equal(normalizeStockHistory(raw("NVDA"),"NVDA","1min",now).size,15);
 const developing=raw("NVDA");developing.values=developing.values.slice(0,3);
 assert.equal(normalizeStockHistory(developing,"NVDA","1min",Date.UTC(2026,9,19,13,32,30)).size,2);
 const bad=raw("NVDA");bad.values[0].datetime="2026-10-19 13:30:01";
 assert.throws(()=>normalizeStockHistory(bad,"NVDA","1min",now));
 assert.throws(()=>normalizeStockHistory(raw("NVDA","5min"),"NVDA","1min",now));
});
test("minute histories are isolated from old five-minute cache, shared by inverse pairs and obey refresh TTL",async()=>{
 const disk:UniverseDisk=emptyProviderDisk();let time=now;const calls:URL[]=[];
 const p=new UniverseProvider({key:"test-only",disk,now:()=>time,fetcher:async input=>{const u=new URL(String(input));calls.push(u);const symbol=u.searchParams.get("symbol")!;
  assert.equal(u.pathname,"/time_series");assert.equal(u.searchParams.get("interval"),"1min");assert.equal(u.searchParams.get("outputsize"),"5000");assert.equal(u.searchParams.get("timezone"),"UTC");assert.equal(u.searchParams.get("adjust"),"none");return Response.json(raw(symbol));}});
 disk.universe!.quotes=Object.fromEntries(["NVDA","TSLA"].map(symbol=>[symbol,{status:"ready" as const,checkedAt:time,nextAt:time+3600000,value:{symbol,currency:"USD" as const,price:100,timestamp:time,marketOpen:false}}]));
 disk.universe!.histories["NVDA:5min"]={status:"ready",checkedAt:time,nextAt:time+3600000,values:[[time-300000,999]]};
 const first=await p.get(pair,[],"1min");assert.equal(first.market.histories["1min"]?.points.length,15);assert.equal(first.market.histories["1min"]?.points[0].value,.5);
 const inverse=await p.get({base:"TSLA",quote:"NVDA"},[],"1min");assert.equal(inverse.market.histories["1min"]?.points[0].value,2);assert.equal(calls.length,2);
 time+=299000;await p.get(pair,[],"1min");assert.equal(calls.length,2);
 time+=2000;await p.get(pair,[],"1min");assert.equal(calls.length,4);assert.equal(disk.used,4);
 assert.equal(disk.universe!.histories["NVDA:5min"].values[0][1],999);
});
