import test from "node:test";
import assert from "node:assert/strict";
import {ratioAxis,sameAxisPrice,measureCloses,elapsedLabel,connectedCandles} from "../lib/chart-presentation";
import {RatioBar} from "../lib/chart-data";
import {nyTime} from "../lib/market-calendar";
test("connected display joins only adjacent same-session bodies, preserves real closes and never mutates source OHLC",()=>{
 const start=nyTime("2026-10-19",9,30);
 const make=(timestamp:number,open:number,close:number):RatioBar=>({timestamp,open,close,high:Math.max(open,close)+.01,low:Math.min(open,close)-.01,expected:15,samples:15,complete:true});
 const original=[make(start,.5,.51),make(start+900000,.54,.55),make(start+1800000,.48,.47),make(start+3600000,.6,.61),make(nyTime("2026-10-20",9,30),.7,.72)];
 const before=structuredClone(original),drawn=connectedCandles(original);
 assert.equal(drawn[1].open,.51);assert.equal(drawn[1].low,.51);
 assert.equal(drawn[2].open,.55);assert.equal(drawn[2].high,.55);
 assert.deepEqual(drawn[0],original[0]);assert.deepEqual(drawn[3],original[3]);assert.deepEqual(drawn[4],original[4]);
 assert.deepEqual(original,before);assert.deepEqual(drawn.map(b=>b.close),original.map(b=>b.close));
 assert.deepEqual(drawn.map(b=>b.timestamp),original.map(b=>b.timestamp));
 assert.ok(drawn.every(b=>b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)));
});
test("axis labels use compact precision without changing values; missing prices never merge",()=>{
 assert.equal(ratioAxis(1.695567891),"1.6956");assert.equal(ratioAxis(.000123),"0.000123");assert.equal(ratioAxis(NaN),"—");
 assert.equal(sameAxisPrice(1.69556,1.69557),true);assert.equal(sameAxisPrice(1.6955,1.6956),false);
 assert.equal(sameAxisPrice(undefined,undefined),false);assert.equal(sameAxisPrice(NaN,1),false);
});
test("ruler uses directed close-to-close ratio return and absolute elapsed time, not leveraged position PnL",()=>{
 const a={timestamp:100000000,close:.5},b={timestamp:100000000+3*86400000,close:.55};
 const m=measureCloses(a,b,2,9);assert.ok(Math.abs(m.change-10)<1e-10);assert.equal(m.bars,8);assert.equal(m.elapsed,3*86400000);assert.equal(elapsedLabel(m.elapsed),"3d");
 const reverse=measureCloses(b,a,9,2);assert.ok(Math.abs(reverse.change-(-100/11))<1e-10);assert.equal(reverse.elapsed,m.elapsed);
 assert.equal(measureCloses(a,a,2,2).change,0);assert.equal(elapsedLabel(0),"0m");assert.equal(elapsedLabel((24*60+65)*60000),"1d 1h 5m");
});
