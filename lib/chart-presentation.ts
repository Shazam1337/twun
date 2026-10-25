/** Presentation only: never used by account valuation or execution. */
import type {RatioBar} from "./chart-data";
import {nyDate} from "./market-calendar";
/** Synthetic display opens only. Never bridge missing buckets or a session boundary. */
export function connectedCandles(bars:RatioBar[]):RatioBar[]{
 return bars.map((bar,i)=>{
  const previous=bars[i-1];
  if(!previous||nyDate(previous.timestamp)!==nyDate(bar.timestamp)||previous.timestamp+previous.expected*60000!==bar.timestamp)return {...bar};
  const open=previous.close;
  return {...bar,open,high:Math.max(bar.high,open),low:Math.min(bar.low,open)};
 });
}
export function ratioAxis(price:number){
 if(!Number.isFinite(price))return "—";
 return price.toFixed(price!==0&&Math.abs(price)<.001?6:4);
}
export function sameAxisPrice(a:number|undefined,b:number|undefined){
 return a!==undefined&&b!==undefined&&Number.isFinite(a)&&Number.isFinite(b)&&ratioAxis(a)===ratioAxis(b);
}
export function measureCloses(a:{timestamp:number;close:number},b:{timestamp:number;close:number},from:number,to:number){
 return {change:(b.close/a.close-1)*100,delta:b.close-a.close,elapsed:Math.abs(b.timestamp-a.timestamp),bars:Math.abs(to-from)+1};
}
export function elapsedLabel(ms:number){
 const minutes=Math.round(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
 return [days?`${days}d`:"",hours?`${hours}h`:"",rest||!minutes?`${rest}m`:""].filter(Boolean).join(" ");
}
