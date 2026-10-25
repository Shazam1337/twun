import type {HistoryPoint} from "./market";
import {marketSession,nyDate,nyTime} from "./market-calendar";
import {Activity} from "./perps";
import {Pair,DEFAULT_PAIR,pairId} from "./catalog";
import {NewsArticle} from "./news";
/** Same common starting timestamp, not separately normalized unaligned histories. */
export function componentSeries(points:HistoryPoint[]){
 const good=(p:HistoryPoint)=>p.value!==null&&Number.isFinite(p.baseClose)&&p.baseClose!>0&&Number.isFinite(p.quoteClose)&&p.quoteClose!>0;
 const first=points.find(good);
 if(!first)return [];
 return points.filter(p=>p.timestamp>=first.timestamp).map(p=>({timestamp:p.timestamp,base:good(p)?100*p.baseClose!/first.baseClose!:null,quote:good(p)?100*p.quoteClose!/first.quoteClose!:null}));
}
export type ChartEvent={id:string;timestamp:number;type:"Open"|"Close"|"Liquidation"|"News";label:string;url?:string};
export function pairEvents(pair:Pair,history:Activity[],articles:NewsArticle[]):ChartEvent[]{
 const trades=history.filter(e=>pairId(e.pair??DEFAULT_PAIR)===pairId(pair)&&e.kind!=="Funding"&&Number.isFinite(e.indexTime)).map(e=>({id:e.id,timestamp:e.indexTime!,type:e.kind as "Open"|"Close"|"Liquidation",label:`Demo ${e.kind}${e.closedFraction?" "+e.closedFraction*100+"%":""} · ${e.side} · ${e.ratio.toFixed(5)}`}));
 const unique=new Map(articles.filter(a=>a.symbols.includes(pair.base)||a.symbols.includes(pair.quote)).map(a=>[a.url,a]));
 return [...trades,...[...unique.values()].map(a=>({id:a.id,timestamp:a.publishedAt,type:"News" as const,label:a.headline,url:a.url}))].sort((a,b)=>a.timestamp-b.timestamp);
}
export function bucketEvents(events:ChartEvent[],buckets:{timestamp:number;end:number}[]){
 const output=new Map<number,ChartEvent[]>();
 for(const e of events){const b=buckets.find(b=>e.timestamp>=b.timestamp&&e.timestamp<b.end);if(!b)continue;const list=output.get(b.timestamp)??[];list.push(e);output.set(b.timestamp,list);}
 return output;
}
export type CandleFrame="15m"|"1h"|"1D";
export type RatioBar={timestamp:number;open:number;high:number;low:number;close:number;samples:number;expected:number;complete:boolean};
/** Observed OHLC of matched 1m CLOSE ratios, NOT continuous/tick OHLC. */
export function ratioBars(points:HistoryPoint[],frame:CandleFrame,now:number):RatioBar[]{
 const groups=new Map<number,{points:HistoryPoint[];expected:number;end:number}>();
 const sessions=new Map<string,{start:number;close:number;open:boolean}>();
 for(const point of [...points].sort((a,b)=>a.timestamp-b.timestamp)){
  const date=nyDate(point.timestamp);let session=sessions.get(date);
  if(!session){const start=nyTime(date,9,30),s=marketSession(start+1);session={start,close:s.closesAt,open:s.state==="open"};sessions.set(date,session);}
  const {start,close}=session;
  if(point.timestamp%60000!==0||!session.open||point.timestamp<start||point.timestamp>=close||point.timestamp+60000>now)continue;
  const width=frame==="15m"?900000:frame==="1h"?3600000:close-start;
  const timestamp=start+Math.floor((point.timestamp-start)/width)*width,end=Math.min(timestamp+width,close);
  const group=groups.get(timestamp)??{points:[],expected:(end-timestamp)/60000,end};group.points.push(point);groups.set(timestamp,group);
 }
 return [...groups].sort((a,b)=>a[0]-b[0]).flatMap(([timestamp,group])=>{
  const valid=group.points.filter(p=>p.value!==null&&Number.isFinite(p.value)&&p.value!>0);
  // Duplicate, missing, incomplete or unmatched observations must not fabricate a wick.
  if(group.end>now||valid.length!==group.expected||new Set(valid.map(p=>p.timestamp)).size!==group.expected)return [];
  const values=valid.map(p=>p.value!);
  return [{timestamp,open:values[0],high:Math.max(...values),low:Math.min(...values),close:values.at(-1)!,samples:values.length,expected:group.expected,complete:true}];
 });
}
export function movingAverage(points:{timestamp:number;value:number|null}[],period:number,exponential=false){
 const output:{timestamp:number;value:number}[]=[],window:number[]=[];let previous:number|undefined,last=0;
 for(const point of points){
  if(point.value===null||!Number.isFinite(point.value)){window.length=0;previous=undefined;last=0;continue;}
  // Reset across missing intraday observations, but allow the regular overnight break.
  if(last&&nyDate(last)===nyDate(point.timestamp)&&point.timestamp-last>3600000){window.length=0;previous=undefined;}
  window.push(point.value);if(window.length>period)window.shift();last=point.timestamp;
  if(window.length<period)continue;
  const mean=window.reduce((a,b)=>a+b,0)/period;
  const value=exponential&&previous!==undefined?previous+(point.value-previous)*2/(period+1):mean;
  previous=value;output.push({timestamp:point.timestamp,value});
 }
 return output;
}
