import test from "node:test";
import assert from "node:assert/strict";
import {ACQUIRE,COMMIT,READ,RELEASE,RedisMarketStorage,MarketStorageError} from "../lib/market-storage";
import {SharedMarket} from "../lib/shared-market";
import {emptyProviderDisk,TwelveProvider} from "../lib/twelve-provider";
const at=Date.UTC(2026,9,19,15),pair={base:"NVDA",quote:"TSLA"};
// Deterministic Redis REST contract fixture, never used by production adapters.
function redis(){
 let raw:string|null=null,token:string|null=null,expires=0,clock=0,broken=false;
 const commands:unknown[][]=[];
 const fetcher:typeof fetch=async(_url,init)=>{
  if(broken)throw Error("redis credentials must not escape");
  const args=JSON.parse(String(init?.body));commands.push(args);
  assert.equal(new Headers(init?.headers).get("authorization"),"Bearer test-only");
  let result:unknown=null;const script=args[1];
  if(script===ACQUIRE){if(clock>=expires)token=null;if(token)result=[0,""];else{token=args[5];expires=clock+Number(args[6]);result=[1,raw??""];}}
  else if(script===COMMIT){if(clock>=expires)token=null;if(token===args[5]){raw=args[6];expires=clock+Number(args[7]);result=1;}else result=0;}
  else if(script===RELEASE){if(token===args[4]){token=null;result=1;}else result=0;}
  else if(script===READ)result=raw;else throw Error("Unexpected Redis script");
  return Response.json({result});
 };
 return {store:()=>new RedisMarketStorage({url:"https://fixture.upstash.io",token:"test-only",fetcher}),commands,get raw(){return raw;},set raw(v:string|null){raw=v;},advance:(ms:number)=>clock+=ms,break:()=>broken=true};
}
function upstream(calls:{count:number},before?:()=>void):typeof fetch{return async(url)=>{
 before?.();calls.count++;const u=new URL(String(url)),symbols=u.searchParams.get("symbol")!.split(","),interval=u.searchParams.get("interval");
 const items=Object.fromEntries(symbols.map(symbol=>[symbol,u.pathname==="/quote"?{symbol,currency:"USD",exchange:"NASDAQ",close:symbol==="NVDA"?"100":"200",is_market_open:true,last_quote_at:at/1000}:{meta:{symbol,currency:"USD",exchange:"NASDAQ",exchange_timezone:"America/New_York",interval},values:[{datetime:"2026-10-15",close:"100"},{datetime:"2026-10-16",close:"110"}]}]));
 return Response.json(symbols.length===1?items[symbols[0]]:items);
};}
test("two serverless instances share quote/history cache and pre-dispatch quota, including cold restart",async()=>{
 const r=redis(),calls={count:0};
 const make=()=>new SharedMarket({storage:r.store(),key:"test-key",now:()=>at,fetcher:upstream(calls,()=>assert.ok(JSON.parse(r.raw!).disk.used>0))});
 const [first,busy]=await Promise.all([make().get(pair,[],"1day"),make().get(pair,[],"1day")]);
 assert.equal(first.market.snapshot!.ratio,.5);assert.equal(busy.market.canTrade,false);assert.equal(calls.count,3);
 const commits=r.commands.filter(args=>args[1]===COMMIT).length;
 const restarted=await make().get(pair,[],"1day");assert.equal(restarted.market.snapshot!.ratio,.5);assert.equal(restarted.budget.used,4);assert.equal(calls.count,3);
 assert.equal(r.commands.filter(args=>args[1]===COMMIT).length,commits,"Unchanged cache checks must not rewrite the full journal");
 assert.ok((await make().ticker()).items.find(i=>i.symbol==="NVDA")!.price===100);
 assert.ok((await make().catalog()).NVDA);assert.equal(calls.count,3);
});
test("lease takeover fences the old writer and old release cannot delete new ownership",async()=>{
 const r=redis(),a=await r.store().acquire();assert.ok(a);r.advance(90001);
 const b=await r.store().acquire();assert.ok(b);b.disk.used=5;
 // A valid persisted disk includes the universe initialized by the adapter.
 b.disk.universe={quotes:{},histories:{},catalog:{},logosChecked:{}};
 await b.save(b.disk);await assert.rejects(a.save(a.disk),/lease_lost/);await a.release();
 assert.equal(await r.store().acquire(),null);assert.equal((await r.store().read()).used,5);await b.release();
});
test("failed asynchronous journal commit prevents every upstream call",async()=>{
 let requests=0;
 const provider=new TwelveProvider({key:"test-key",now:()=>at,persist:async()=>{await Promise.resolve();throw Error("storage failed");},fetcher:async()=>{requests++;throw Error();}});
 await assert.rejects(provider.requestSymbols("quote",["NVDA"],{}));assert.equal(requests,0);
 const r=redis();r.break();const shared=new SharedMarket({storage:r.store(),key:"test-key",fetcher:async()=>{requests++;throw Error();}});
 await assert.rejects(shared.get(pair,[],"1day"),MarketStorageError);assert.equal(requests,0);
});
test("invalid shared quota journal fails closed; missing key requires neither Redis nor upstream",async()=>{
 const r=redis();r.raw='{"version":1,"disk":{"used":"broken"}}';
 await assert.rejects(r.store().read(),MarketStorageError);await assert.rejects(r.store().acquire(),MarketStorageError);
 r.break();const shared=new SharedMarket({storage:r.store(),key:""});assert.equal((await shared.get(pair,[],"1day")).market.status,"not_configured");
});
test("429 backoff and charged attempt survive across independent serverless instances",async()=>{
 const r=redis();let count=0;
 const make=()=>new SharedMarket({storage:r.store(),key:"test-key",now:()=>at,fetcher:async()=>{count++;return new Response("",{status:429,headers:{"Retry-After":"180"}});}});
 const a=await make().get(pair,[],"1day"),b=await make().get(pair,[],"1day");
 assert.equal(a.market.status,"quota_exhausted");assert.equal(b.market.status,"quota_exhausted");assert.equal(count,1);assert.equal(b.budget.used,2);assert.equal(b.budget.retryAt,at+180000);
});
test("global minute/day budget is preserved, including provider failures",async()=>{
 const r=redis();let credits=0;
 const make=()=>new SharedMarket({storage:r.store(),key:"test-key",dayBudget:2,minuteBudget:2,now:()=>at,fetcher:async(url)=>{credits+=new URL(String(url)).searchParams.get("symbol")!.split(",").length;return new Response("",{status:503});}});
 await make().get(pair,[],"1day");await make().get({base:"AAPL",quote:"MSFT"},[],"1day");
 assert.equal(credits,2);assert.equal((await r.store().read()).used,2);
});
