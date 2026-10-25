import test from "node:test";
import assert from "node:assert/strict";
import {initialPerpsState,openPosition,closePosition,advanceFunding,setMark,liquidationRatio,totals,isPerpsState,PerpsState,Result} from "../lib/perps";
import {componentSeries,pairEvents,bucketEvents} from "../lib/chart-data";
import {joinHistory} from "../lib/universe-feed";
const state=(r:Result)=>{assert.ok(r.ok);return r.state;};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test("partial closing allocates margin, funding, entry fee and notional; full aggregate settlement stays identical",()=>{
 for(const side of ["Long","Short"] as const)for(const mark of [.48,.55]){
  let s=state(openPosition(initialPerpsState(),side,100,5));s=state(advanceFunding(s));s=state(setMark(s,mark));
  const p=s.positions[0],id=p.id,full=state(closePosition(s,id)),liq=liquidationRatio(p);
  s=state(closePosition(s,id,.25));const remainder=s.positions[0];near(remainder.margin,75);near(remainder.notional,375);near(remainder.entryFee,.1875);near(remainder.funding,p.funding*.75);near(liquidationRatio(remainder),liq);assert.equal(remainder.lastFundingAt,p.lastFundingAt);assert.equal(s.history[0].closedFraction,.25);assert.ok(isPerpsState(s));
  s=state(closePosition(s,id,.5));assert.ok(isPerpsState(s));s=state(closePosition(s,id));near(s.freeUsdc,full.freeUsdc);near(totals(s).realized,totals(full).realized);near(totals(s).funding,totals(full).funding);near(totals(s).fees,totals(full).fees);
 }
});
test("invalid close percentages cannot change state; a maintenance breach fully liquidates, not a partial escape",()=>{
 const s=state(openPosition(initialPerpsState(),"Long",100,5)),id=s.positions[0].id,before=JSON.stringify(s);
 for(const f of [0,-1,NaN,Infinity,1.1])assert.equal(closePosition(s,id,f).ok,false);assert.equal(JSON.stringify(s),before);
 const breached={...s,mark:.4};const liquidated=state(closePosition(breached,id,.25));assert.equal(liquidated.positions.length,0);assert.equal(liquidated.history[0].kind,"Liquidation");
});
test("components start at one common observation, normalize from actual underlying closes and preserve unmatched gaps",()=>{
 const a={values:[[1,100],[2,110],[3,90]] as [number,number][],status:"ready" as const,checkedAt:4,nextAt:9},b={...a,values:[[1,200],[2,190],[4,200]] as [number,number][]};
 const history=joinHistory(a,b,"5min")!,components=componentSeries(history.points);
 assert.equal(components[0].base,100);assert.equal(components[0].quote,100);near(components[1].base!,110);near(components[1].quote!,95);assert.equal(components[2].base,null);
 assert.deepEqual(componentSeries([{timestamp:1,value:.5,label:""}]),[]);
});
test("event markers isolate oriented pairs, use source index time, deduplicate news and never fill missing price buckets",()=>{
 const entry={id:"e",positionId:"p",kind:"Open" as const,side:"Long" as const,time:999999,indexTime:1200,ratio:.5,notional:500,pnl:0,fee:.25,funding:0,payout:0,net:0,shortfall:0,pair:{base:"NVDA",quote:"TSLA"}};
 const article={id:"n",headline:"Publisher headline",summary:"",source:"Publisher",url:"https://example.test/a",publishedAt:1500,symbols:["NVDA"]};
 const events=pairEvents(entry.pair,[entry,{...entry,id:"other",pair:{base:"TSLA",quote:"NVDA"}}],[article,article]);assert.equal(events.length,2);assert.equal(events[0].timestamp,1200);
 const buckets=bucketEvents([...events,{id:"future",type:"News",timestamp:3500,label:"No candle"}],[{timestamp:1000,end:2000}]);assert.equal(buckets.size,1);assert.equal(buckets.get(1000)!.length,2);
});
