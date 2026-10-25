"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {IChartApi,ISeriesApi,UTCTimestamp,Time,MouseEventParams,LogicalRange} from "lightweight-charts";
import {Maximize2,Minimize2,RotateCcw,SlidersHorizontal,Ruler} from "lucide-react";
import {liquidationRatio,pnl,signed} from "@/lib/perps";
import {nyDate} from "@/lib/market-calendar";
import {DEFAULT_PAIR,pairId} from "@/lib/catalog";
import {historyChange,HistoryPoint,Interval,feedMessages} from "@/lib/market";
import {useOlderHistory} from "./use-older-history";
import {ratioBars,movingAverage,CandleFrame,componentSeries,pairEvents,bucketEvents,ChartEvent} from "@/lib/chart-data";
import {useNews} from "./news-feed";
import {useMarket} from "./market-store";
import {useDemo} from "./demo-store";
import {ratioAxis,sameAxisPrice,connectedCandles} from "@/lib/chart-presentation";
import {ChartInspection,InspectionApi} from "./chart-inspection";
type MainSeries=ISeriesApi<"Candlestick">|ISeriesApi<"Line">;
const fmt=(n:number)=>n.toFixed(5),utc=(n:number)=>Math.floor(n/1000) as UTCTimestamp;
const observationTime=(n:number)=>new Date(n).toLocaleString("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC";
const NO_EVENTS:ChartEvent[]=[];
const NO_POINTS:HistoryPoint[]=[];
export function PairChart({onHistoryChange}:{onHistoryChange?:(change:number|null)=>void}){
 const {feed,loading,pair,setInterval,historySeconds,setHistorySeconds,now}=useMarket(),{state}=useDemo();
 const [mode]=useState<"candles"|"line">("candles"),[frame,setFrame]=useState<CandleFrame>("1h"),[sma,setSma]=useState(false),[ema,setEma]=useState(false),[levels,setLevels]=useState(true),[expanded,setExpanded]=useState(false),[ready,setReady]=useState(0),[error,setError]=useState("");
 const host=useRef<HTMLDivElement>(null),chart=useRef<IChartApi|null>(null),series=useRef<MainSeries|null>(null),extras=useRef<ISeriesApi<"Line">[]>([]),signature=useRef("");
 const legend=useRef<HTMLDivElement>(null),hover=useRef<HTMLDivElement>(null);
 const interacted=useRef(false),plottedTimes=useRef<number[]>([]);
 const [settings,setSettings]=useState(false),[sessions,setSessions]=useState<{x:number;label:string;gap:string}[]>([]);
 const [ruler,setRuler]=useState(false),[inspectionApi,setInspectionApi]=useState<InspectionApi|null>(null),[selectedId,setSelectedId]=useState("");
 const [view,setView]=useState<"ratio"|"components">("ratio"),[tradeMarkers,setTradeMarkers]=useState(true),[newsMarkers,setNewsMarkers]=useState(false),[hoverEvents,setHoverEvents]=useState<ChartEvent[]>([]);
 useEffect(()=>setRuler(false),[pair.base,pair.quote,frame,view]);
 const news=useNews([pair.base,pair.quote],newsMarkers);
 const [preferencesReady,setPreferencesReady]=useState(false);
 const [connected,setConnected]=useState(true);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("twun-chart-v2")??"null");if(saved){if(typeof saved.connected==="boolean")setConnected(saved.connected);if(["ratio","components"].includes(saved.view))setView(saved.view);if(typeof saved.tradeMarkers==="boolean")setTradeMarkers(saved.tradeMarkers);if(typeof saved.newsMarkers==="boolean")setNewsMarkers(saved.newsMarkers);if(["15m","1h","1D"].includes(saved.frame))setFrame(saved.frame);if([300,900,1800,3600].includes(saved.historySeconds))setHistorySeconds(saved.historySeconds);if(typeof saved.sma==="boolean")setSma(saved.sma);if(typeof saved.ema==="boolean")setEma(saved.ema);if(typeof saved.levels==="boolean")setLevels(saved.levels);}}catch{}setPreferencesReady(true);},[setHistorySeconds]);
 useEffect(()=>{if(preferencesReady)try{localStorage.setItem("twun-chart-v2",JSON.stringify({mode,frame,historySeconds,sma,ema,levels,view,tradeMarkers,newsMarkers,connected}));}catch{}},[preferencesReady,mode,frame,historySeconds,sma,ema,levels,view,tradeMarkers,newsMarkers,connected]);
 const source="1min" as Interval;
 useEffect(()=>setInterval(source),[source,setInterval]);
 const history=feed?.histories[source];
 const older=useOlderHistory(pair,history?.points??NO_POINTS),points=older.points;
 useEffect(()=>onHistoryChange?.(historyChange(points)),[points,onHistoryChange]);
 const bars=useMemo(()=>ratioBars(points,frame,now()),[points,frame]);
 const drawnBars=useMemo(()=>connected?connectedCandles(bars):bars,[bars,connected]);
 const components=useMemo(()=>componentSeries(points),[points]);
 const eventGroups=useMemo(()=>{
  const events=pairEvents(pair,tradeMarkers?state.history:[],newsMarkers?Object.values(news.feeds).flatMap(f=>f.articles):[]);
  const buckets=view==="ratio"&&mode==="candles"?bars.map(b=>({timestamp:b.timestamp,end:b.timestamp+b.expected*60000})):points.filter(p=>p.value!==null).map(p=>({timestamp:p.timestamp,end:p.timestamp+(source==="1min"?60000:86400000)}));
  return bucketEvents(events,buckets);
 },[pair.base,pair.quote,state.history,tradeMarkers,newsMarkers,news.feeds,bars,points,view,mode,source]);
 useEffect(()=>setHoverEvents(NO_EVENTS),[eventGroups]);
 const index=feed?.snapshot,lastBar=bars.at(-1),lastPoint=points.filter(p=>p.value!==null).at(-1);
 const lastClose=mode==="candles"?lastBar?.close:lastPoint?.value??undefined;
 const closeTime=mode==="candles"&&lastBar?lastBar.timestamp+lastBar.expected*60000:lastPoint?lastPoint.timestamp+(source==="1min"?60000:0):undefined;
 const closeLabel=closeTime===undefined?"—":mode==="line"&&source==="1day"?new Date(closeTime).toLocaleDateString("en-GB",{timeZone:"America/New_York",day:"2-digit",month:"short"})+" · ET session":observationTime(closeTime);
 const valid=points.filter(p=>p.value!==null).length;
 const positions=state.positions.filter(p=>pairId(p.pair??DEFAULT_PAIR)===pairId(pair));
 const positionKey=positions.map(p=>`${p.id}:${p.entryRatio}:${p.funding}`).join("|");
 const selectedPosition=positions.find(p=>p.id===selectedId)??positions[0];
 useEffect(()=>{
  let disposed=false;
  void import("lightweight-charts").then(lib=>{
   if(disposed||!host.current)return;
   const c=lib.createChart(host.current,{autoSize:true,layout:{background:{type:lib.ColorType.Solid,color:"#ffffff"},textColor:"#68748b",fontFamily:"'DM Mono',monospace",fontSize:11,attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{color:"#f1f3f8"}},crosshair:{mode:lib.CrosshairMode.Normal},rightPriceScale:{borderColor:"#e1e5ef",scaleMargins:{top:.15,bottom:.12}},timeScale:{borderColor:"#e1e5ef",timeVisible:true,secondsVisible:false,rightOffset:5},localization:{locale:"en-US",priceFormatter:ratioAxis}});
   chart.current=c;setReady(v=>v+1);
  }).catch(()=>setError("Chart could not load. Reload the page to retry."));
  return()=>{disposed=true;chart.current?.remove();chart.current=null;series.current=null;};
 },[]);
 useEffect(()=>{
  const c=chart.current;if(!c||!ready)return;let disposed=false,cleanup=()=>{};
  void import("lightweight-charts").then(lib=>{
   if(disposed)return;
   const visibleRange=c.timeScale().getVisibleLogicalRange();
   if(series.current)c.removeSeries(series.current);for(const s of extras.current)c.removeSeries(s);extras.current=[];
   const precision={type:"price" as const,precision:view==="components"?2:4,minMove:view==="components"?.01:.0001};
   const s=view==="ratio"&&mode==="candles"?c.addSeries(lib.CandlestickSeries,{upColor:"#20a17b",downColor:"#d94d58",borderVisible:true,borderUpColor:"#13805f",borderDownColor:"#c43f4b",wickUpColor:"#13805f",wickDownColor:"#c43f4b",priceFormat:precision}):c.addSeries(lib.LineSeries,{color:"#2851ff",lineWidth:2,priceFormat:precision});series.current=s;
   s.applyOptions({priceLineVisible:false,lastValueVisible:false});
   if(view==="ratio"&&lastClose!==undefined&&!sameAxisPrice(lastClose,index?.ratio))s.createPriceLine({price:lastClose,color:"#8490a5",lineStyle:lib.LineStyle.Dashed,lineWidth:1,title:mode==="candles"?"Candle close":"History close",axisLabelVisible:true});
   if(view==="ratio"&&index)s.createPriceLine({price:index.ratio,color:"#2851ff",lineStyle:lib.LineStyle.Solid,lineWidth:2,title:sameAxisPrice(lastClose,index.ratio)?"Index / close":"Current index",axisLabelVisible:true});
   if(view==="components"){
    s.setData(components.map(p=>p.base===null?{time:utc(p.timestamp)}:{time:utc(p.timestamp),value:p.base}));
    const second=c.addSeries(lib.LineSeries,{color:"#ed8a32",lineWidth:2,priceFormat:precision,priceLineVisible:false,lastValueVisible:true});second.setData(components.map(p=>p.quote===null?{time:utc(p.timestamp)}:{time:utc(p.timestamp),value:p.quote}));extras.current.push(second);
    s.applyOptions({lastValueVisible:true});s.createPriceLine({price:100,color:"#abb5c8",lineWidth:1,lineStyle:lib.LineStyle.Dashed,title:"Base 100",axisLabelVisible:true});
   }else if(mode==="candles")s.setData(drawnBars.map(b=>({time:utc(b.timestamp),open:b.open,high:b.high,low:b.low,close:b.close})));
   else s.setData(points.map(p=>p.value===null?{time:utc(p.timestamp)}:{time:utc(p.timestamp),value:p.value}));
   const observations=mode==="candles"?bars.map(b=>({timestamp:b.timestamp,value:b.close})):points;
   for(const [enabled,period,exponential,color] of [[sma,20,false,"#e59c20"],[ema,50,true,"#8a62ce"]] as const){if(!enabled||view==="components")continue;const avg=c.addSeries(lib.LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:precision});avg.setData(movingAverage(observations,period,exponential).map(p=>({time:utc(p.timestamp),value:p.value})));extras.current.push(avg);}
   if(levels&&view==="ratio"&&selectedPosition){const p=selectedPosition;s.createPriceLine({price:p.entryRatio,color:"#2851ff",lineWidth:1,lineStyle:lib.LineStyle.Dashed,title:`${p.side} entry`,axisLabelVisible:true});const liq=liquidationRatio(p);if(liq>0)s.createPriceLine({price:liq,color:"#dc534d",lineWidth:1,lineStyle:lib.LineStyle.Dotted,title:"Est. liq · demo",axisLabelVisible:true});}
   lib.createSeriesMarkers(s,[...eventGroups].sort((a,b)=>a[0]-b[0]).flatMap(([t,events])=>[...new Set(events.map(e=>e.type))].map(type=>({time:utc(t),position:type==="Open"?"belowBar" as const:"aboveBar" as const,color:type==="Open"?"#168b69":type==="Liquidation"?"#d94d58":type==="News"?"#ed8a32":"#2851ff",shape:type==="News"?"square" as const:type==="Open"?"arrowUp" as const:"circle" as const,text:type==="News"?`News ${events.filter(e=>e.type===type).length}`:type,size:.7}))));
   const key=pairId(pair)+mode+frame+view,times=view==="ratio"&&mode==="candles"?bars.map(b=>b.timestamp):points.map(p=>p.timestamp);
   if(signature.current!==key||!visibleRange){c.timeScale().setVisibleLogicalRange({from:Math.max(0,times.length-45),to:Math.max(1,times.length+3)});signature.current=key;interacted.current=false;}
   else {const first=plottedTimes.current[0],nextFirst=times[0],added=first===undefined?0:times.filter(t=>t<first).length,removed=nextFirst===undefined?0:plottedTimes.current.filter(t=>t<nextFirst).length;c.timeScale().setVisibleLogicalRange({from:visibleRange.from+added-removed,to:visibleRange.to+added-removed});}
   plottedTimes.current=times;setInspectionApi({chart:c,series:s});
   const render=(value:{open?:number;high?:number;low?:number;close?:number;value?:number}|undefined,time?:Time)=>{
    if(!legend.current)return;
    if(view==="components"){const selected=(typeof time==="number"?components.find(p=>p.timestamp===time*1000):undefined)??components.at(-1);legend.current.textContent=selected?`${pair.base} ${selected.base?.toFixed(2)??"—"}  ·  ${pair.quote} ${selected.quote?.toFixed(2)??"—"}`:"Matched component history unavailable";if(hover.current)hover.current.textContent=typeof time==="number"?observationTime(time*1000):"Both stocks normalized to 100 at the same starting observation";return;}
    const selected:{open?:number;high?:number;low?:number;close?:number;value?:number}|undefined=mode==="candles"?(typeof time==="number"?bars.find(b=>b.timestamp===time*1000):bars.at(-1)):value??{value:points.filter(p=>p.value!==null).at(-1)?.value??undefined};
    if(!selected){legend.current.textContent="No complete candles in this window";return;}
    legend.current.textContent=mode==="candles"?`O ${fmt(selected.open!)}   H ${fmt(selected.high!)}   L ${fmt(selected.low!)}   C ${fmt(selected.close!)}`:`Ratio ${selected.value!==undefined?fmt(selected.value):"—"}`;
    if(hover.current)hover.current.textContent=typeof time==="number"?new Date(time*1000).toLocaleString("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC":"Hover to inspect · Scroll to zoom · Drag to pan";
   };
   render(undefined);
   const crosshair=(param:MouseEventParams)=>{const data=param.seriesData.get(s);render(data&&("open" in data||"value" in data)?data:undefined,param.time);const events=typeof param.time==="number"?eventGroups.get(param.time*1000)??NO_EVENTS:NO_EVENTS;setHoverEvents(old=>old===events?old:events);};
   const boundaries=bars.filter((b,i)=>!i||nyDate(b.timestamp)!==nyDate(bars[i-1].timestamp));
   const updateSessions=()=>{
    if(mode!=="candles"||view==="components"){setSessions([]);return;}
    setSessions(boundaries.flatMap(b=>{const i=bars.indexOf(b),prev=bars[i-1],x=c.timeScale().timeToCoordinate(utc(b.timestamp)),px=prev?c.timeScale().timeToCoordinate(utc(prev.timestamp)):null;if(x===null)return [];const at=px===null?Number(x):((Number(x)+Number(px))/2);if(at<0||at>(host.current?.clientWidth??0)-88)return [];return [{x:at,label:new Date(b.timestamp).toLocaleDateString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric"}),gap:prev?`${(b.open/prev.close-1)*100>=0?"+":""}${((b.open/prev.close-1)*100).toFixed(2)}% gap`:""}];}));
   };
   const onScroll=(visible:LogicalRange|null)=>{updateSessions();if(visible&&visible.from<10&&interacted.current)void older.loadMore();};
   updateSessions();c.timeScale().subscribeVisibleLogicalRangeChange(onScroll);c.timeScale().subscribeSizeChange(updateSessions);
   c.subscribeCrosshairMove(crosshair);cleanup=()=>{try{c.unsubscribeCrosshairMove(crosshair);c.timeScale().unsubscribeVisibleLogicalRangeChange(onScroll);c.timeScale().unsubscribeSizeChange(updateSessions);}catch{}};
  }).catch(()=>setError("Chart data could not be displayed."));
  return()=>{disposed=true;cleanup();};
 },[ready,points,bars,drawnBars,mode,frame,sma,ema,levels,positionKey,selectedPosition?.id,pair.base,pair.quote,index?.ratio,index?.timestamp,lastClose,view,components,eventGroups,older.loadMore]);
 useEffect(()=>{if(!expanded)return;const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(false);};window.addEventListener("keydown",key);const before=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{window.removeEventListener("keydown",key);document.body.style.overflow=before;};},[expanded]);
 const enough=view==="components"?components.filter(p=>p.base!==null&&p.quote!==null).length>1:mode==="candles"?bars.length>0:valid>1;
 return <div className={"twun-trading-chart"+(expanded?" is-expanded":"")}>
  <div className="twun-chart-controls"><div className="twun-chart-segment" aria-label="Chart content"><button aria-pressed={view==="ratio"} onClick={()=>setView("ratio")}>Ratio</button><button aria-pressed={view==="components"} onClick={()=>setView("components")}>Components</button></div>{view==="ratio"&&mode==="candles"&&<div className="twun-chart-segment" aria-label="Candle timeframe">{(["15m","1h","1D"] as const).map(f=><button key={f} aria-pressed={frame===f} onClick={()=>setFrame(f)}>{f}</button>)}</div>}<button className="twun-chart-icon" aria-label="Measure ratio change" aria-pressed={ruler} disabled={view!=="ratio"||!bars.length} title="Drag between candle closes to measure ratio change" onClick={()=>setRuler(!ruler)}><Ruler size={15}/></button><button className="twun-chart-icon" aria-label="Chart settings" aria-expanded={settings} aria-controls="chart-settings" title="Indicators, refresh and data details" onClick={()=>setSettings(!settings)}><SlidersHorizontal size={15}/></button><button className="twun-chart-icon" aria-label="Reset chart zoom" title="Fit all available data" onClick={()=>chart.current?.timeScale().fitContent()}><RotateCcw size={15}/></button><button className="twun-chart-icon" aria-label={expanded?"Exit expanded chart":"Expand chart"} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button></div>
  {settings&&<div id="chart-settings" className="twun-chart-settings"><div className="twun-chart-indicators"><button disabled={view==="components"} aria-pressed={sma} onClick={()=>setSma(!sma)}>SMA 20</button><button disabled={view==="components"} aria-pressed={ema} onClick={()=>setEma(!ema)}>EMA 50</button><button disabled={view==="components"} aria-pressed={levels} onClick={()=>setLevels(!levels)}>Position levels</button><button aria-pressed={tradeMarkers} onClick={()=>setTradeMarkers(!tradeMarkers)}>My trades</button><button aria-pressed={newsMarkers} onClick={()=>setNewsMarkers(!newsMarkers)}>News events</button><label className="twun-chart-refresh">Intraday refresh<select aria-label="History refresh interval" disabled={source==="1day"} value={historySeconds} onChange={e=>setHistorySeconds(Number(e.target.value))}>{[5,15,30,60].map(m=><option key={m} value={m*60}>{m} min</option>)}</select></label></div><p className="twun-chart-data-note">Candles aggregate synchronized 1-minute closes, not tick-level OHLC. Subtle dividers mark New York sessions; hover a candle for session dates and sampled opening gaps. Overnight prices are not fabricated. Quotes refresh ≥120s; daily history has a 6h cache. <a href="/chart-model.md" target="_blank" rel="noreferrer">Methodology ↗</a></p></div>}
  {view==="ratio"&&<div className="twun-chart-style"><button aria-label="Connected candles" aria-pressed={connected} onClick={()=>setConnected(!connected)}>{connected?"Connected candles ✓":"Observed candles"}</button><span>{connected?"Visual adjustment · Connected opens, not raw OHLC. Quotes and PnL unchanged.":"Original 1-minute sampled OHLC · Click to connect candle bodies."}</span></div>}<div className="twun-chart-readout"><strong>{pair.base}/{pair.quote}</strong><span ref={legend} className="mono"/>{view==="ratio"&&sma&&<small className="twun-chart-active-study">SMA 20</small>}{view==="ratio"&&ema&&<small className="twun-chart-active-study">EMA 50</small>}</div>
  {view==="ratio"&&<div className="twun-chart-price-context" aria-label="Index and historical close"><div className="is-index"><span>Current index</span><strong className="mono" data-testid="chart-current-index">{index?fmt(index.ratio):"—"}</strong><time>{index?observationTime(index.timestamp):"Quote unavailable"}</time></div><div><span>{mode==="candles"?"Last completed candle":"Last history close"}</span><strong className="mono" data-testid="chart-last-close">{lastClose===undefined?"—":fmt(lastClose)}</strong><time>{closeLabel}</time></div></div>}
  <div className="twun-chart-canvas-wrap" onPointerDown={()=>{if(!ruler)interacted.current=true;}} onWheel={()=>{if(!ruler)interacted.current=true;}}><div ref={host} className="twun-chart-canvas" aria-label="Interactive ratio chart"/><div className="twun-chart-sessions" aria-hidden="true">{sessions.map(s=><div key={s.label} style={{left:s.x}}></div>)}</div>{view==="ratio"&&<ChartInspection key={pairId(pair)+frame+view} api={inspectionApi} bars={bars} displayBars={connected?drawnBars:undefined} enabled={ruler} frame={frame} pair={pairId(pair)}/ >}{(!enough||error)&&<div className="twun-chart-overlay"><strong>{error||(loading?"Loading market history…":view==="components"?"Matched component history unavailable":mode==="candles"?"Complete sampled candles unavailable":"Ratio history unavailable")}</strong><p>{feed?.status==="not_configured"?"Connect Twelve Data to see validated market history.":history&&history.status!=="ready"?feedMessages[history.status]:"Load earlier observations or choose another candle timeframe. Missing observations are never invented."}</p></div>}</div>
  <div className="twun-chart-inspect" ref={hover}>Hover to inspect · Scroll to zoom · Drag to pan</div>
  {view==="ratio"&&levels&&selectedPosition&&<div className="twun-chart-position" aria-label="Selected chart position"><label>Position<select aria-label="Chart position" value={selectedPosition.id} onChange={e=>setSelectedId(e.target.value)}>{positions.map((p,i)=><option value={p.id} key={p.id}>{p.side} #{i+1} · {p.leverage}x</option>)}</select></label><span>Entry <b className="mono">{fmt(selectedPosition.entryRatio)}</b></span><span>Est. liquidation <b className="mono">{liquidationRatio(selectedPosition)>0?fmt(liquidationRatio(selectedPosition)):"Not positive"}</b></span><span>Unrealized PnL <b className={(pnl(selectedPosition,selectedPosition.mark??state.mark)>=0?"is-positive":"is-negative")+" mono"}>{signed(pnl(selectedPosition,selectedPosition.mark??state.mark))} USDC</b></span><small>Demo · Before fees and funding · {index?"Accepted account mark":"Last accepted mark · feed unavailable"}</small></div>}
  <div className="twun-chart-history-loader"><button aria-label="Load earlier chart history" disabled={older.loading||older.done||!points.length||Date.now()<older.retryAt} onClick={()=>void older.loadMore()}>{older.loading?"Loading earlier candles…":older.done?"History boundary reached":"← Load earlier history"}</button><span role="status">{older.message||"Drag right to explore earlier candles · History loads near the left edge"}</span></div>
  {view==="components"&&<div className="twun-components-key" data-testid="components-baseline"><span>{pair.base} · blue</span><span>{pair.quote} · orange</span><small>Both start at 100 on {components[0]?observationTime(components[0].timestamp):"the first common observation"}. No stock ownership.</small></div>}
  {(tradeMarkers||newsMarkers)&&<details className="twun-chart-events"><summary>Chart events · {[...eventGroups.values()].reduce((n,list)=>n+list.length,0)} <small>My demo trades / publisher news</small></summary>{newsMarkers&&(news.failed||Object.values(news.feeds).some(f=>f.status!=="ready"))&&<p role="status">Some news feeds are unavailable or cached. No missing headlines are invented.</p>}{!eventGroups.size&&<p>No events within the displayed completed observations. Events never extend the price history.</p>}{(hoverEvents.length?hoverEvents:[...eventGroups.values()].flat().sort((a,b)=>b.timestamp-a.timestamp)).slice(0,30).map(e=><div key={e.type+e.id}><span>{e.type} · {observationTime(e.timestamp)}</span>{e.url?<a href={e.url} target="_blank" rel="noreferrer">{e.label} ↗</a>:<strong>{e.label}</strong>}</div>)}<p>Markers group events inside observed bars. News is context, not a proven cause of a price move. Showing up to 30 events; hover a bar to inspect its events.</p></details>}
  <div className="twun-chart-coverage"><span>{mode==="candles"?`Ratio candles · 1-minute sampled prices · ${bars.length} complete candles`:`${valid} matched closes`} · UTC · {source==="1day"?"6h":`${historySeconds/60}m`} history refresh</span>{points.length>0&&<span>Available {new Date(points[0].timestamp).toLocaleDateString("en-GB")}–{new Date(points.at(-1)!.timestamp).toLocaleDateString("en-GB")}</span>}{history?.status!=="ready"&&history&&<span role="status">Cached history · {feedMessages[history.status]}</span>}<a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></div>
 </div>;
}
