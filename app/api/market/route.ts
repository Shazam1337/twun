import { marketProvider } from "@/lib/market-server";
import { DEFAULT_PAIR, stock, validPair } from "@/lib/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request) {
  const u=new URL(request.url), pair={base:u.searchParams.get("base")??DEFAULT_PAIR.base,quote:u.searchParams.get("quote")??DEFAULT_PAIR.quote};
  const watch=[...new Set((u.searchParams.get("watch")??"").split(",").filter(Boolean))], interval=u.searchParams.get("interval")??"1day";
  const historySeconds=Number(u.searchParams.get("historySeconds")??300);
  if(![300,900,1800,3600].includes(historySeconds))return Response.json({error:"History refresh must be 300, 900, 1800 or 3600 seconds."},{status:400});
  if(!validPair(pair)||watch.length>50||watch.some(s=>!stock(s))||!["1min","5min","1day"].includes(interval))return Response.json({error:"Choose two different catalog stocks and a supported interval."},{status:400});
  try{return Response.json(await marketProvider().get(pair,watch,interval as "1min"|"5min"|"1day",historySeconds),{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Market service unavailable. Calculations paused."},{status:503});}
}
