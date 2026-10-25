import {marketProvider} from "@/lib/market-server";
import {validPair} from "@/lib/catalog";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function GET(request:Request){const p=new URL(request.url).searchParams,pair={base:p.get("base")??"NVDA",quote:p.get("quote")??"TSLA"};if(!validPair(pair))return Response.json({error:"Choose two different catalog stocks."},{status:400});try{return Response.json(await marketProvider().analytics(pair),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Analytics data unavailable. Please retry later."},{status:503});}}
