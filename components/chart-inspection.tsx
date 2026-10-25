"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {IChartApi,ISeriesApi,MouseEventParams,UTCTimestamp} from "lightweight-charts";
import {RatioBar} from "@/lib/chart-data";
import {elapsedLabel,measureCloses} from "@/lib/chart-presentation";
import {nyDate} from "@/lib/market-calendar";
export type InspectionApi={chart:IChartApi;series:ISeriesApi<"Candlestick">|ISeriesApi<"Line">};
const full=(n:number)=>n.toFixed(8).replace(/0+$/,"").replace(/\.$/,"");
const stamp=(n:number)=>new Date(n).toLocaleString("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC";
export function ChartInspection({api,bars,displayBars,enabled,frame,pair}:{api:InspectionApi|null;bars:RatioBar[];displayBars?:RatioBar[];enabled:boolean;frame:string;pair:string}){
 const [tip,setTip]=useState<{bar:RatioBar;x:number;y:number;gap:number|null}|null>(null);
 const [selection,setSelection]=useState<{from:number;to:number;complete:boolean}|null>(null),[keyboard,setKeyboard]=useState(0),[,redraw]=useState(0);
 const layer=useRef<HTMLDivElement>(null),dragging=useRef(false),active=useRef(enabled);active.current=enabled;
 const byTime=useMemo(()=>new Map(bars.map((b,i)=>[b.timestamp,{bar:b,index:i}])),[bars]);
 useEffect(()=>{
  if(!api)return;
  const move=(p:MouseEventParams)=>{
   if(active.current||typeof p.time!=="number"||!p.point||p.point.x<0||p.point.y<0||p.point.x>api.chart.timeScale().width()||p.point.y>api.chart.paneSize().height){setTip(null);return;}
   const found=byTime.get(p.time*1000);if(!found){setTip(null);return;}
   const sessionFirst=bars.findIndex(b=>nyDate(b.timestamp)===nyDate(found.bar.timestamp)),first=bars[sessionFirst],prev=bars[sessionFirst-1];
   setTip({bar:found.bar,x:Math.max(8,Math.min(p.point.x+18,api.chart.timeScale().width()-252)),y:Math.max(8,Math.min(p.point.y+18,api.chart.paneSize().height-(displayBars?330:254))),gap:prev?(first.open/prev.close-1)*100:null});
  };
  const refresh=()=>{setTip(null);redraw(n=>n+1);};
  api.chart.subscribeCrosshairMove(move);api.chart.timeScale().subscribeVisibleLogicalRangeChange(refresh);api.chart.timeScale().subscribeSizeChange(refresh);
  return()=>{try{api.chart.unsubscribeCrosshairMove(move);api.chart.timeScale().unsubscribeVisibleLogicalRangeChange(refresh);api.chart.timeScale().unsubscribeSizeChange(refresh);}catch{}};
 },[api,bars,byTime,displayBars]);
 useEffect(()=>{setTip(null);setSelection(null);dragging.current=false;},[enabled]);
 useEffect(()=>{setSelection(null);dragging.current=false;},[bars[0]?.timestamp]);
 const pick=(clientX:number)=>{if(!api||!layer.current)return null;const time=api.chart.timeScale().coordinateToTime(clientX-layer.current.getBoundingClientRect().left);return typeof time==="number"?byTime.get(time*1000)?.index??null:null;};
 const a=selection?bars[selection.from]:undefined,b=selection?bars[selection.to]:undefined;
 const measured=a&&b&&selection?measureCloses(a,b,selection.from,selection.to):null;
 const xy=(bar:RatioBar)=>api?{x:api.chart.timeScale().timeToCoordinate(bar.timestamp/1000 as UTCTimestamp),y:api.series.priceToCoordinate(bar.close)}:null;
 const start=a?xy(a):null,end=b?xy(b):null;
 const showLine=start?.x!=null&&start.y!=null&&end?.x!=null&&end.y!=null;
 return <>
  {!enabled&&tip&&<div className="twun-candle-tooltip" data-testid="candle-tooltip" style={{left:tip.x,top:tip.y}}><header><strong>{pair}</strong><span>{frame} candle</span></header><time>{stamp(tip.bar.timestamp)}–{new Date(tip.bar.timestamp+tip.bar.expected*60000).toLocaleTimeString("en-GB",{timeZone:"UTC",hour:"2-digit",minute:"2-digit"})}</time>{displayBars&&<p className="twun-tooltip-source">Observed OHLC below · Bodies visually connected</p>}<dl>{(["open","high","low","close"] as const).map(key=><div key={key}><dt>{key[0].toUpperCase()+key.slice(1)}</dt><dd>{full(tip.bar[key])}</dd></div>)}<div><dt>Change · Open → Close</dt><dd className={tip.bar.close>=tip.bar.open?"is-positive":"is-negative"}>{((tip.bar.close/tip.bar.open-1)*100).toFixed(3)}%</dd></div></dl>{displayBars&&<div className="twun-tooltip-display" data-testid="display-candle-open">Drawn open: {full(displayBars.find(b=>b.timestamp===tip.bar.timestamp)?.open??tip.bar.open)}<small>Drawn range includes this open; not observed extremes.</small></div>}<footer>New York session · {nyDate(tip.bar.timestamp)}{tip.gap!==null&&<span>Sampled session gap {tip.gap>=0?"+":""}{tip.gap.toFixed(2)}%</span>}<span>{tip.bar.samples} matched 1-minute closes · sampled OHLC</span></footer></div>}
  {enabled&&<div ref={layer} className="twun-measure-layer" tabIndex={0} role="group" aria-label="Ratio ruler. Drag between candles, or use arrow keys and Enter to select two closes. Escape clears." onPointerDown={e=>{if(e.button!==0)return;const i=pick(e.clientX);if(i===null)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();setKeyboard(i);dragging.current=true;setSelection({from:i,to:i,complete:false});}} onPointerMove={e=>{if(!dragging.current)return;const i=pick(e.clientX);if(i!==null)setSelection(s=>s?{...s,to:i}:s);}} onPointerUp={e=>{if(!dragging.current)return;dragging.current=false;const i=pick(e.clientX);setSelection(s=>s?{...s,to:i??s.to,complete:true}:s);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{dragging.current=false;setSelection(null);}} onKeyDown={e=>{if(e.key==="Escape"){setSelection(null);return;}if(["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();const i=Math.max(0,Math.min(bars.length-1,keyboard+(e.key==="ArrowRight"?1:-1)));setKeyboard(i);setSelection(s=>s&&!s.complete?{...s,to:i}:s);}if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelection(s=>s&&!s.complete?{...s,to:keyboard,complete:true}:{from:keyboard,to:keyboard,complete:false});}}}>
   {showLine&&<svg className="twun-measure-drawing" width="100%" height="100%" aria-hidden="true"><rect x={Math.min(Number(start!.x),Number(end!.x))} y={Math.min(Number(start!.y),Number(end!.y))} width={Math.max(1,Math.abs(Number(end!.x)-Number(start!.x)))} height={Math.max(1,Math.abs(Number(end!.y)-Number(start!.y)))}/><line x1={Number(start!.x)} y1={Number(start!.y)} x2={Number(end!.x)} y2={Number(end!.y)}/>{[start!,end!].map((p,i)=><circle key={i} cx={Number(p.x)} cy={Number(p.y)} r="4"/>)}</svg>}
   <div className="twun-ruler-result" role="status" data-testid="ruler-result">{measured&&a&&b?<><strong className={measured.change>=0?"is-positive":"is-negative"}>{measured.change>=0?"+":""}{measured.change.toFixed(3)}% <small>ratio change</small></strong><span>{full(a.close)} → {full(b.close)}</span><span>{measured.bars} candles · {elapsedLabel(measured.elapsed)} elapsed</span><span>{stamp(a.timestamp)} → {stamp(b.timestamp)}</span><small>Snapped candle closes · Not position PnL</small></>:<><strong>Measure ratio change</strong><span>Drag between candle closes.</span><small>Keyboard: arrows + Enter twice. Escape clears.</small></>}</div>
  </div>}
 </>;
}
