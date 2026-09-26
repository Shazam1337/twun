import { marketProvider } from "@/lib/market-server";
import { stock } from "@/lib/catalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const symbol=new URL(request.url).searchParams.get("verify");
  if(symbol && !stock(symbol))return Response.json({error:"Unknown catalog stock"},{status:400});
  try{return Response.json(symbol?await marketProvider().verify(symbol):{catalog:marketProvider().catalog()},{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Catalog verification unavailable"},{status:503});}
}
