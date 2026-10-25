import test from "node:test";
import assert from "node:assert/strict";
import {ratioBars,movingAverage} from "../lib/chart-data";
import {nyTime} from "../lib/market-calendar";
const start=nyTime("2026-10-19",9,30),now=start+8*3600000;
const points=(values:(number|null)[])=>values.map((value,i)=>({timestamp:start+i*60000,value,label:""}));
test("sampled ratio OHLC uses matched observations, never divides underlying extremes",()=>{
 const bars=ratioBars(points([.5,...Array(12).fill(.51),.55,.52,.6,...Array(12).fill(.58),.57,.59]),"15m",now);
 assert.equal(bars.length,2);assert.deepEqual([bars[0].open,bars[0].high,bars[0].low,bars[0].close],[.5,.55,.5,.52]);
 assert.equal(bars[0].samples,15);
});
test("inverse candle extrema are computed from inverted observations",()=>{
 const inverse=ratioBars(points([1/.5,...Array(12).fill(1/.51),1/.55,1/.52]),"15m",now)[0];assert.equal(inverse.high,2);assert.equal(inverse.low,1/.55);assert.equal(inverse.close,1/.52);
});
test("missing, unmatched, duplicate and unfinished samples cannot create complete candles",()=>{
 assert.equal(ratioBars(points([.5,null,.52]),"15m",now).length,0);
 assert.equal(ratioBars(points([.5,.52]),"15m",now).length,0);
 assert.equal(ratioBars(points([.5,.55,.52]),"15m",start+800000).length,0);
 assert.equal(ratioBars([...points([.5,.55,.52]),points([.5])[0]],"15m",now).length,0);
});
test("hourly bars anchor to NY session open and allow the completed 30-minute closing bucket",()=>{
 const bars=ratioBars(points(Array.from({length:390},(_,i)=>.5+i/1000)),"1h",now);
 assert.equal(bars.length,7);assert.equal(bars[0].timestamp,start);assert.equal(bars[0].samples,60);assert.equal(bars.at(-1)!.samples,30);
 assert.equal(ratioBars(points(Array(390).fill(.5)),"1D",now).length,1);
 const early=nyTime("2026-11-27",9,30),p=Array.from({length:210},(_,i)=>({timestamp:early+i*60000,value:.5,label:""}));assert.equal(ratioBars(p,"1D",early+4*3600000)[0].samples,210);
});
test("one missing minute or an old five-minute feed cannot masquerade as a complete candle",()=>{
 const full=points(Array(15).fill(.5));
 assert.equal(ratioBars(full,"15m",now).length,1);
 assert.equal(ratioBars(full.filter((_,i)=>i!==7),"15m",now).length,0);
 assert.equal(ratioBars(full.map((p,i)=>i===7?{...p,value:null}:p),"15m",now).length,0);
 assert.equal(ratioBars([...full,full[7]],"15m",now).length,0);
 assert.equal(ratioBars(full,"15m",start+899999).length,0);
 assert.equal(ratioBars(full.filter((_,i)=>i%5===0),"15m",now).length,0);
 assert.equal(ratioBars(full.map(p=>({...p,timestamp:p.timestamp+1000})),"15m",now).length,0);
});
test("SMA and EMA use period closes, warm up and reset on unmatched observations",()=>{
 const p=points([1,2,3,4,null,5,6,7]);assert.deepEqual(movingAverage(p,3).map(p=>p.value),[2,3,6]);assert.deepEqual(movingAverage(p,3,true).map(p=>p.value),[2,3,6]);
});
