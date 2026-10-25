import { marketProvider, verifyLocalCatalog } from "@/lib/market-server";
import { stock } from "@/lib/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const symbol=new URL(request.url).searchParams.get("verify");
  if(symbol && !stock(symbol))return Response.json({error:"Unknown catalog stock"},{status:400});
  if(symbol&&(process.env.VERCEL||process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL))return Response.json({error:"Catalog verification is available locally only."},{status:403});
  try{return Response.json(symbol?await verifyLocalCatalog(symbol):{catalog:await marketProvider().catalog()},{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Catalog verification unavailable"},{status:503});}
}
