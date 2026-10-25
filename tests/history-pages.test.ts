import test from "node:test";
import assert from "node:assert/strict";
import {UniverseProvider,UniverseDisk} from "../lib/universe-provider";
import {SharedMarket} from "../lib/shared-market";
import {MarketStorage,MarketLease} from "../lib/market-storage";
import {emptyProviderDisk} from "../lib/twelve-provider";
const now=Date.UTC(2026,9,20,15),before=Date.UTC(2026,9,12,13,30),pair={base:"NVDA",quote:"TSLA"};
function storage(){let disk:UniverseDisk=emptyProviderDisk(),locked=false;return {read:async()=>structuredClone(disk),acquire:async():Promise<MarketLease|null>=>{if(locked)return null;locked=true;return {disk:structuredClone(disk),save:async d=>{disk=structuredClone(d);},release:async()=>{locked=false;}};}} satisfies MarketStorage;}
function response(symbol:string,empty=false,ignore=false){return Response.json({meta:{symbol,currency:"USD",exchange:"NASDAQ",exchange_timezone:"America/New_York",interval:"1min"},values:empty?[]:[0,1,2].map((i)=>({datetime:new Date((ignore?before+600000:before-900000)+i*300000).toISOString().slice(0,19).replace("T"," "),close:symbol==="NVDA"?100+i:200+i}))});}
test("historical pages use a strict UTC end cursor, preserve component prices, share symbols and never request quotes",async()=>{
 const disk:UniverseDisk=emptyProviderDisk();let calls=0;
 const p=new UniverseProvider({key:"test-only",disk,now:()=>now,fetcher:async input=>{calls++;const u=new URL(String(input));assert.equal(u.pathname,"/time_series");assert.equal(u.searchParams.get("end_date"),"2026-10-12 13:29:00");assert.equal(u.searchParams.get("adjust"),"none");return response(u.searchParams.get("symbol")!);}});
 const result=await p.historyPage(pair,before);assert.equal(result.status,"ready");assert.equal(result.hasMore,true);assert.equal(result.history?.points[0].value,.5);assert.equal(result.history?.points[0].baseClose,100);assert.ok(result.history!.points.every(p=>p.timestamp<before));
 await p.historyPage(pair,before);await p.historyPage({base:"TSLA",quote:"NVDA"},before);assert.equal(calls,2);assert.equal(disk.used,2);assert.deepEqual(disk.universe?.quotes,{});
});
test("independent instances deduplicate history pages through the shared lease and quota journal",async()=>{
 const s=storage();let calls=0;const make=()=>new SharedMarket({key:"test-only",storage:s,now:()=>now,fetcher:async input=>{calls++;assert.ok((await s.read()).used>0);return response(new URL(String(input)).searchParams.get("symbol")!);}});
 await Promise.all([make().historyPage(pair,before),make().historyPage(pair,before)]);await make().historyPage(pair,before);assert.equal(calls,2);
});
test("empty validated responses end pagination, while ignored cursors and provider failures never fabricate old history",async()=>{
 const empty=new UniverseProvider({key:"test-only",now:()=>now,fetcher:async input=>response(new URL(String(input)).searchParams.get("symbol")!,true)});
 const end=await empty.historyPage(pair,before);assert.equal(end.status,"ready");assert.equal(end.hasMore,false);assert.equal(end.history,null);
 const bad=new UniverseProvider({key:"test-only",now:()=>now,fetcher:async input=>response(new URL(String(input)).searchParams.get("symbol")!,false,true)});assert.equal((await bad.historyPage(pair,before)).status,"partial");
 let calls=0;const quota=new UniverseProvider({key:"test-only",now:()=>now,fetcher:async()=>{calls++;return new Response("",{status:429,headers:{"Retry-After":"180"}});}});assert.equal((await quota.historyPage(pair,before)).status,"quota_exhausted");await quota.historyPage(pair,before);assert.equal(calls,1);
});
test("missing key and failed quota persistence do not dispatch history requests",async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw Error();};
 assert.equal((await new UniverseProvider({key:"",fetcher}).historyPage(pair,before)).status,"not_configured");
 const p=new UniverseProvider({key:"test-only",fetcher,now:()=>now,persist:async()=>{throw Error();}});await assert.rejects(p.historyPage(pair,before));assert.equal(calls,0);
});
