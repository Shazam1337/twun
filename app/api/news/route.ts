import {getNews} from "@/lib/news-server";
import {stock} from "@/lib/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const scopes=params.has("symbols")?params.get("symbols")!.split(","): [params.get("symbol")||"market"];
 if(params.has("symbol")&&params.has("symbols")||scopes.length>2||scopes.some(s=>s!=="market"&&!stock(s))||scopes.some(s=>!s))return Response.json({error:"Choose a catalog stock or two pair symbols."},{status:400});
 const feeds=Object.fromEntries(await Promise.all([...new Set(scopes)].map(async scope=>[scope,await getNews(scope)])));
 return Response.json({feeds},{headers:{"Cache-Control":"no-store"}});
}
