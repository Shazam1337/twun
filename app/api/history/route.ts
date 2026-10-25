import {marketProvider} from "@/lib/market-server";
import {validPair} from "@/lib/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,pair={base:params.get("base")??"",quote:params.get("quote")??""},before=Number(params.get("before"));
 if(!validPair(pair)||!Number.isSafeInteger(before)||before<Date.UTC(2000,0,1)||before>Date.now()+10000||before%60000!==0)return Response.json({error:"Choose a catalog pair and valid 1-minute history cursor."},{status:400});
 try{return Response.json(await marketProvider().historyPage(pair,before),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Historical data unavailable. Existing chart and positions are unchanged."},{status:503});}
}
